using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using OtoServis.Api.Models;

namespace OtoServis.Api.Services;

public sealed class AiOptions
{
    public string GeminiApiKey { get; set; } = "";
    public string OpenAiApiKey { get; set; } = "";
    public List<AiProviderOption> Providers { get; set; } = DefaultProviders();

    public static List<AiProviderOption> DefaultProviders() =>
    [
        new() { Name = "gemini", Model = "gemini-3.5-flash-lite" },
        new() { Name = "gemini", Model = "gemini-3.5-flash" },
        new() { Name = "openai", Model = "gpt-4o-mini" },
        new() { Name = "ocr", Model = "tesseract" },
    ];
}

public sealed class AiProviderOption
{
    public string Name { get; set; } = "";
    public string Model { get; set; } = "";
}

public sealed class AiScanService(
    HttpClient http,
    IOptions<AiOptions> options,
    OcrScanService ocr,
    ILogger<AiScanService> log)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private const string Prompt = """
        Bu görsel bir Türkiye Cumhuriyeti araç tescil belgesidir (ruhsat).
        Görseldeki bilgileri oku ve SADECE aşağıdaki alanları içeren bir JSON döndür:
        {"plate":"","brand":"","model":"","year":"","color":"","fuel":"","chassis":"","engineNo":"","engineVolume":""}

        Kurallar:
        - plate: Plaka; "34 ABC 123" biçiminde, harfler BÜYÜK, aralarında tek boşluk. (A) PLAKA alanından oku. Tip onay no (TR 2007/46) plaka değildir.
        - brand: Marka; (D.1) MARKASI alanından (örn. Fiat, Volkswagen, Renault).
        - model: Ticari ad / model; (D.3) TİCARİ ADI alanından (örn. Egea, 500L, Passat). Etiket metnini (TİCARİ ADI) yazma. Tip kodunu (D.2) yazma.
        - year: Model yılı, 4 haneli; (D.4) MODEL YILI alanından (örn. 2019).
        - color: Renk, Türkçe; (R) RENGİ alanından (örn. Beyaz, Gri). Marka adı renk değildir.
        - fuel: Yakıt; şu değerlerden biri: Benzin, Dizel, LPG, Elektrik, Hibrit. BENZİNLİ → Benzin.
        - chassis: Şasi (VIN), (E) ŞASİ NO alanından, genelde 17 karakter, BÜYÜK harf. Motor no ile karıştırma.
        - engineNo: Motor numarası, (P.5) MOTOR NO alanından, BÜYÜK harf. CİNSİ / etiket metni yazma.
        - engineVolume: Silindir hacmi, (P.1) SİLİNDİR HACMİ alanından; örn. "1598" veya "1598 cm³".
        Bir alanı okuyamazsan o alanı boş string ("") bırak.
        Yalnızca geçerli JSON döndür; açıklama, kod bloğu veya başka metin ekleme.
        """;

    public async Task<RuhsatScanResponse> ScanRuhsatAsync(
        string imageBase64,
        string mimeType,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(imageBase64))
            throw new AiScanException("Fotoğraf verisi boş.", HttpStatusCode.BadRequest);

        mimeType = string.IsNullOrWhiteSpace(mimeType) ? "image/jpeg" : mimeType.Trim();
        var cfg = options.Value;
        var providers = (cfg.Providers is { Count: > 0 } ? cfg.Providers : AiOptions.DefaultProviders())
            .Where(p => !string.IsNullOrWhiteSpace(p.Name) && !string.IsNullOrWhiteSpace(p.Model))
            .ToList();

        // AI listesinde OCR yoksa son yedek olarak ekle
        if (!providers.Any(p => p.Name.Equals("ocr", StringComparison.OrdinalIgnoreCase)))
            providers.Add(new AiProviderOption { Name = "ocr", Model = "tesseract" });

        if (providers.Count == 0)
            throw new AiScanException("Yapay zekâ sağlayıcısı yapılandırılmamış.", HttpStatusCode.ServiceUnavailable);

        string? lastDetail = null;
        var lastStatus = HttpStatusCode.BadGateway;
        var skipProviders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < providers.Count; i++)
        {
            var provider = providers[i];
            var name = provider.Name.Trim().ToLowerInvariant();
            if (skipProviders.Contains(name))
                continue;

            if (name == "gemini" && string.IsNullOrWhiteSpace(cfg.GeminiApiKey))
            {
                log.LogWarning("Gemini API anahtarı yok, atlanıyor.");
                skipProviders.Add(name);
                continue;
            }

            if (name == "openai" && string.IsNullOrWhiteSpace(cfg.OpenAiApiKey))
            {
                log.LogWarning("OpenAI API anahtarı yok, atlanıyor.");
                skipProviders.Add(name);
                continue;
            }

            for (var attempt = 0; attempt < 2; attempt++)
            {
                if (attempt > 0)
                    await Task.Delay(900 * attempt, ct);

                ProviderCallResult result;
                try
                {
                    if (name == "ocr")
                    {
                        var parsed = await ocr.ScanAsync(imageBase64, mimeType, ct);
                        if (RuhsatTextParser.HasUsefulFields(parsed))
                        {
                            log.LogInformation("Ruhsat OCR ile okundu.");
                            return new RuhsatScanResponse(
                                parsed.Plate,
                                parsed.Brand,
                                parsed.Model,
                                parsed.Year,
                                parsed.Color,
                                parsed.Fuel,
                                parsed.Chassis,
                                parsed.EngineNo,
                                parsed.EngineVolume,
                                "ocr",
                                provider.Model);
                        }
                        result = new ProviderCallResult(false, 422, "OCR anlamlı alan bulamadı", null);
                    }
                    else
                    {
                        result = name switch
                        {
                            "gemini" => await CallGeminiAsync(provider.Model, cfg.GeminiApiKey, imageBase64, mimeType, ct),
                            "openai" => await CallOpenAiAsync(provider.Model, cfg.OpenAiApiKey, imageBase64, mimeType, ct),
                            _ => new ProviderCallResult(false, (int)HttpStatusCode.BadRequest, $"Bilinmeyen sağlayıcı: {name}", null),
                        };
                    }
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    log.LogWarning(ex, "AI sağlayıcı hatası: {Provider}/{Model}", name, provider.Model);
                    lastStatus = HttpStatusCode.BadGateway;
                    lastDetail = ex.Message;
                    break;
                }

                if (result.Ok && !string.IsNullOrWhiteSpace(result.Text))
                {
                    var fields = ParseScanText(result.Text);
                    log.LogInformation("Ruhsat okundu: {Provider}/{Model}", name, provider.Model);
                    return new RuhsatScanResponse(
                        fields.Plate ?? "",
                        fields.Brand ?? "",
                        fields.Model ?? "",
                        fields.Year ?? "",
                        fields.Color ?? "",
                        fields.Fuel ?? "",
                        fields.Chassis ?? "",
                        fields.EngineNo ?? "",
                        fields.EngineVolume ?? "",
                        name,
                        provider.Model);
                }

                lastStatus = (HttpStatusCode)result.Status;
                lastDetail = result.Detail;

                if (IsAuthError(result.Status, result.Detail ?? ""))
                {
                    log.LogWarning("AI anahtar/yetki hatası, sağlayıcı atlanıyor: {Provider} ({Detail})", name, result.Detail);
                    skipProviders.Add(name);
                    break;
                }

                if (IsQuotaError(result.Status, result.Detail ?? ""))
                {
                    log.LogWarning("AI kota doldu, sağlayıcı atlanıyor: {Provider} ({Detail})", name, result.Detail);
                    skipProviders.Add(name);
                    break;
                }

                if (IsModelUnavailable(result.Status, result.Detail ?? ""))
                {
                    log.LogWarning("AI model kullanılamıyor, sıradakine geçiliyor: {Provider}/{Model} ({Detail})",
                        name, provider.Model, result.Detail);
                    break; // next model / provider
                }

                if (IsCapacityError(result.Status, result.Detail ?? ""))
                    continue; // retry same model, then next

                break; // non-retryable for this model → try next provider/model
            }
        }

        if (IsQuotaError((int)lastStatus, lastDetail ?? ""))
            throw new AiScanException("Yapay zekâ kotası doldu. Biraz sonra tekrar deneyin veya yedek sağlayıcı anahtarını ekleyin.", HttpStatusCode.TooManyRequests);

        if (IsCapacityError((int)lastStatus, lastDetail ?? ""))
            throw new AiScanException("Yapay zekâ şu an yoğun. Birkaç saniye sonra tekrar deneyin.", HttpStatusCode.ServiceUnavailable);

        throw new AiScanException(
            string.IsNullOrWhiteSpace(lastDetail)
                ? "Yapay zekâ isteği başarısız."
                : $"Yapay zekâ isteği başarısız. {lastDetail}",
            lastStatus);
    }

    private async Task<ProviderCallResult> CallGeminiAsync(
        string model,
        string key,
        string base64,
        string mimeType,
        CancellationToken ct)
    {
        var url =
            $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(key)}";

        var body = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = Prompt },
                        new { inline_data = new { mime_type = mimeType, data = base64 } },
                    },
                },
            },
            generationConfig = new { temperature = 0, responseMimeType = "application/json" },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };

        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            return new ProviderCallResult(false, (int)res.StatusCode, ExtractGeminiError(raw), null);

        using var doc = JsonDocument.Parse(raw);
        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        if (string.IsNullOrWhiteSpace(text))
            return new ProviderCallResult(false, 502, "Boş yanıt", null);

        return new ProviderCallResult(true, 200, null, text);
    }

    private async Task<ProviderCallResult> CallOpenAiAsync(
        string model,
        string key,
        string base64,
        string mimeType,
        CancellationToken ct)
    {
        var body = new
        {
            model,
            temperature = 0,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "text", text = Prompt },
                        new
                        {
                            type = "image_url",
                            image_url = new { url = $"data:{mimeType};base64,{base64}" },
                        },
                    },
                },
            },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            return new ProviderCallResult(false, (int)res.StatusCode, ExtractOpenAiError(raw), null);

        using var doc = JsonDocument.Parse(raw);
        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(text))
            return new ProviderCallResult(false, 502, "Boş yanıt", null);

        return new ProviderCallResult(true, 200, null, text);
    }

    private static string ExtractGeminiError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("error", out var err) &&
                err.TryGetProperty("message", out var msg))
                return msg.GetString() ?? raw;
        }
        catch { /* ignore */ }
        return Truncate(raw);
    }

    private static string ExtractOpenAiError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("error", out var err) &&
                err.TryGetProperty("message", out var msg))
                return msg.GetString() ?? raw;
        }
        catch { /* ignore */ }
        return Truncate(raw);
    }

    private static string Truncate(string s) =>
        string.IsNullOrEmpty(s) ? "" : (s.Length <= 300 ? s : s[..300]);

    private static bool IsCapacityError(int status, string detail)
    {
        if (status is 503 or 529) return true;
        var d = detail.ToLowerInvariant();
        return d.Contains("high demand")
               || d.Contains("overloaded")
               || d.Contains("try again")
               || d.Contains("unavailable")
               || d.Contains("temporarily");
    }

    private static bool IsQuotaError(int status, string detail)
    {
        if (status == 429) return true;
        var d = detail.ToLowerInvariant();
        return d.Contains("quota")
               || d.Contains("resource_exhausted")
               || d.Contains("rate limit")
               || d.Contains("billing")
               || d.Contains("insufficient_quota");
    }

    private static bool IsModelUnavailable(int status, string detail)
    {
        var d = detail.ToLowerInvariant();
        return status == 404
               || d.Contains("no longer available")
               || d.Contains("not available to new users")
               || d.Contains("not found")
               || d.Contains("is not supported")
               || d.Contains("unknown model")
               || d.Contains("invalid model");
    }

    private static bool IsAuthError(int status, string detail)
    {
        if (status is 401 or 403) return true;
        if (status != 400) return false;
        var d = detail.ToLowerInvariant();
        return d.Contains("api key")
               || d.Contains("permission")
               || d.Contains("invalid_api_key")
               || d.Contains("incorrect api key");
    }

    private static RuhsatScanFields ParseScanText(string text)
    {
        try
        {
            return Normalize(JsonSerializer.Deserialize<RuhsatScanFields>(text, JsonOpts));
        }
        catch
        {
            var start = text.IndexOf('{');
            var end = text.LastIndexOf('}');
            if (start >= 0 && end > start)
            {
                try
                {
                    return Normalize(JsonSerializer.Deserialize<RuhsatScanFields>(text[start..(end + 1)], JsonOpts));
                }
                catch { /* fall through */ }
            }
            return new RuhsatScanFields();
        }
    }

    private static RuhsatScanFields Normalize(RuhsatScanFields? raw)
    {
        raw ??= new RuhsatScanFields();
        return new RuhsatScanFields
        {
            Plate = (raw.Plate ?? "").Trim().ToUpperInvariant(),
            Brand = (raw.Brand ?? "").Trim(),
            Model = (raw.Model ?? "").Trim(),
            Year = new string((raw.Year ?? "").Where(char.IsDigit).Take(4).ToArray()),
            Color = (raw.Color ?? "").Trim(),
            Fuel = (raw.Fuel ?? "").Trim(),
            Chassis = (raw.Chassis ?? "").Trim().ToUpperInvariant(),
            EngineNo = (raw.EngineNo ?? "").Trim().ToUpperInvariant(),
            EngineVolume = (raw.EngineVolume ?? "").Trim(),
        };
    }

    private sealed record ProviderCallResult(bool Ok, int Status, string? Detail, string? Text);
}

public sealed class AiScanException(string message, HttpStatusCode status) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
}

internal sealed class RuhsatScanFields
{
    public string? Plate { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? Year { get; set; }
    public string? Color { get; set; }
    public string? Fuel { get; set; }
    public string? Chassis { get; set; }
    public string? EngineNo { get; set; }
    public string? EngineVolume { get; set; }
}
