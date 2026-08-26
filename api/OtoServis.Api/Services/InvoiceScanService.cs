using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public sealed class InvoiceScanService(
    HttpClient http,
    IOptions<AiOptions> options,
    ILogger<InvoiceScanService> log)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<InvoiceScanResponse> ScanAsync(
        string fileBase64,
        string? mimeType,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fileBase64))
            throw new AiScanException("PDF verisi boş.", HttpStatusCode.BadRequest);

        byte[] bytes;
        try
        {
            var b64 = fileBase64.Contains(',') ? fileBase64[(fileBase64.IndexOf(',') + 1)..] : fileBase64;
            bytes = Convert.FromBase64String(b64);
        }
        catch
        {
            throw new AiScanException("PDF base64 çözülemedi.", HttpStatusCode.BadRequest);
        }

        if (bytes.Length < 100)
            throw new AiScanException("Dosya çok küçük veya boş.", HttpStatusCode.BadRequest);
        if (bytes.Length > 12 * 1024 * 1024)
            throw new AiScanException("PDF en fazla 12 MB olabilir.", HttpStatusCode.BadRequest);

        mimeType = (mimeType ?? "application/pdf").Trim().ToLowerInvariant();
        if (!mimeType.Contains("pdf") && !(bytes.Length > 4 && bytes[0] == 0x25 && bytes[1] == 0x50)) // %PDF
            throw new AiScanException("Yalnızca PDF dosyası desteklenir.", HttpStatusCode.BadRequest);

        string text;
        try
        {
            text = InvoiceTextParser.ExtractTextFromPdf(bytes);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "PDF metin çıkarma başarısız");
            throw new AiScanException("PDF okunamadı. Dosya bozuk veya korumalı olabilir.", HttpStatusCode.BadRequest);
        }

        var parsed = InvoiceTextParser.Parse(text);
        if (parsed.Lines.Count >= 1)
            return ToResponse(parsed);

        // Metin zayıfsa AI ile satır çıkarmayı dene
        log.LogInformation("PDF satır parse zayıf ({Len} char), AI yedek deneniyor", text.Length);
        var ai = await TryAiParseAsync(text, ct);
        if (ai is not null && ai.Lines.Count > 0)
            return ai;

        if (string.IsNullOrWhiteSpace(text))
            throw new AiScanException(
                "PDF'den metin çıkarılamadı. Tarama (görüntü) PDF'leri için daha net bir dosya deneyin.",
                HttpStatusCode.UnprocessableEntity);

        throw new AiScanException(
            "Fatura satırları okunamadı. Örnek parçacı faturası formatında PDF yükleyin.",
            HttpStatusCode.UnprocessableEntity);
    }

    private static InvoiceScanResponse ToResponse(ParsedInvoice parsed) =>
        new(
            parsed.DocumentNo,
            parsed.DocumentDate,
            parsed.Lines.Select(l => new InvoiceScanLineDto(
                l.Name, l.Quantity, l.UnitPrice, l.LineTotal)).ToList(),
            parsed.Provider);

    private async Task<InvoiceScanResponse?> TryAiParseAsync(string text, CancellationToken ct)
    {
        var cfg = options.Value;
        if (string.IsNullOrWhiteSpace(cfg.GeminiApiKey) && string.IsNullOrWhiteSpace(cfg.OpenAiApiKey))
            return null;

        var snippet = text.Length > 12000 ? text[..12000] : text;
        var prompt = """
            Aşağıdaki Türkçe oto yedek parça faturası / irsaliye metninden ürün satırlarını çıkar.
            SADECE şu JSON'u döndür:
            {"documentNo":"","documentDate":"","lines":[{"name":"","quantity":1,"unitPrice":0,"lineTotal":0}]}

            Kurallar:
            - Tablo sırası genelde: Stok Adı | Miktarı | Fiyat | Tutar
            - name: stok/ürün adı (kısa tut, kesilmişse olduğu gibi bırak; baştaki sıra no'yu alma)
            - quantity: Miktarı sütunu (adet, tam sayı) — Fiyat ile karıştırma!
            - unitPrice: Fiyat sütunu, birim alış (ondalık, nokta ayırıcı; 7400.00)
            - lineTotal: Tutar sütunu (= quantity × unitPrice)
            - Örnek: "ISITMA BUJİSİ … 4,00 150,00 600,00" → quantity=4, unitPrice=150, lineTotal=600
            - Üst bilgi, toplam, nakli yekün, "Stok Adı" başlıklarını satır olarak ekleme
            - Yalnızca geçerli JSON
            """ + "\n\nMETİN:\n" + snippet;

        var providers = (cfg.Providers is { Count: > 0 } ? cfg.Providers : AiOptions.DefaultProviders())
            .Where(p => p.Name is "gemini" or "openai")
            .ToList();

        foreach (var p in providers)
        {
            try
            {
                string? json = p.Name.Equals("gemini", StringComparison.OrdinalIgnoreCase)
                    ? await CallGeminiTextAsync(cfg.GeminiApiKey, p.Model, prompt, ct)
                    : await CallOpenAiTextAsync(cfg.OpenAiApiKey, p.Model, prompt, ct);
                if (string.IsNullOrWhiteSpace(json)) continue;
                var dto = JsonSerializer.Deserialize<AiInvoiceDto>(StripFences(json), JsonOpts);
                if (dto?.Lines is null || dto.Lines.Count == 0) continue;
                var lines = dto.Lines
                    .Where(l => !string.IsNullOrWhiteSpace(l.Name) && l.UnitPrice > 0)
                    .Select(l => new InvoiceScanLineDto(
                        l.Name!.Trim(),
                        Math.Max(1, l.Quantity),
                        l.UnitPrice,
                        l.LineTotal > 0 ? l.LineTotal : l.UnitPrice * Math.Max(1, l.Quantity)))
                    .ToList();
                if (lines.Count == 0) continue;
                return new InvoiceScanResponse(dto.DocumentNo, dto.DocumentDate, lines, $"{p.Name}:{p.Model}");
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Fatura AI parse başarısız: {Provider}/{Model}", p.Name, p.Model);
            }
        }
        return null;
    }

    private async Task<string?> CallGeminiTextAsync(string apiKey, string model, string prompt, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return null;
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
        var body = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.1, responseMimeType = "application/json" },
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();
    }

    private async Task<string?> CallOpenAiTextAsync(string apiKey, string model, string prompt, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return null;
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        var body = new
        {
            model,
            temperature = 0.1,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = "Sen fatura satırı çıkaran bir JSON üreticisisin." },
                new { role = "user", content = prompt },
            },
        };
        req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
    }

    private static string StripFences(string s)
    {
        s = s.Trim();
        if (s.StartsWith("```"))
        {
            var i = s.IndexOf('\n');
            s = i >= 0 ? s[(i + 1)..] : s;
            if (s.EndsWith("```")) s = s[..^3];
        }
        return s.Trim();
    }

    private sealed class AiInvoiceDto
    {
        public string? DocumentNo { get; set; }
        public string? DocumentDate { get; set; }
        public List<AiLineDto>? Lines { get; set; }
    }

    private sealed class AiLineDto
    {
        public string? Name { get; set; }
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
    }
}
