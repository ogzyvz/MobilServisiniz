using Tesseract;

namespace OtoServis.Api.Services;

public sealed class OcrScanService(IWebHostEnvironment env, ILogger<OcrScanService> log)
{
    public Task<ParsedRuhsat> ScanAsync(string imageBase64, string mimeType, CancellationToken ct = default)
    {
        return Task.Run(() => ScanCore(imageBase64, mimeType), ct);
    }

    private ParsedRuhsat ScanCore(string imageBase64, string mimeType)
    {
        var tessDir = ResolveTessDataPath();
        if (tessDir is null)
        {
            log.LogWarning("tessdata klasörü bulunamadı; OCR atlanıyor.");
            return ParsedRuhsat.Empty;
        }

        var lang = ResolveLang(tessDir);
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(StripDataUrl(imageBase64));
        }
        catch (FormatException)
        {
            log.LogWarning("OCR: geçersiz base64.");
            return ParsedRuhsat.Empty;
        }

        if (bytes.Length < 100)
            return ParsedRuhsat.Empty;

        var ext = mimeType.Contains("png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
        var temp = Path.Combine(Path.GetTempPath(), $"ruhsat-ocr-{Guid.NewGuid():N}{ext}");
        try
        {
            File.WriteAllBytes(temp, bytes);
            using var engine = new TesseractEngine(tessDir, lang, EngineMode.Default);
            engine.SetVariable("user_defined_dpi", "300");
            using var img = Pix.LoadFromFile(temp);
            using var page = engine.Process(img);
            var text = page.GetText() ?? "";
            log.LogInformation("OCR metin uzunluğu={Len}, dil={Lang}", text.Length, lang);
            return RuhsatTextParser.Parse(text);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Tesseract OCR başarısız.");
            return ParsedRuhsat.Empty;
        }
        finally
        {
            try { File.Delete(temp); } catch { /* ignore */ }
        }
    }

    private string? ResolveTessDataPath()
    {
        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "tessdata"),
            Path.Combine(AppContext.BaseDirectory, "tessdata"),
            Path.Combine(Directory.GetCurrentDirectory(), "tessdata"),
        };
        return candidates.FirstOrDefault(d =>
            Directory.Exists(d) &&
            (File.Exists(Path.Combine(d, "eng.traineddata")) ||
             File.Exists(Path.Combine(d, "tur.traineddata"))));
    }

    private static string ResolveLang(string tessDir)
    {
        var hasTur = File.Exists(Path.Combine(tessDir, "tur.traineddata"));
        var hasEng = File.Exists(Path.Combine(tessDir, "eng.traineddata"));
        if (hasTur && hasEng) return "tur+eng";
        if (hasTur) return "tur";
        return "eng";
    }

    private static string StripDataUrl(string s)
    {
        var idx = s.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
        return idx >= 0 ? s[(idx + 7)..] : s.Trim();
    }
}
