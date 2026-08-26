using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace OtoServis.Api.Services;

/// <summary>
/// OCR ham metninden Türk ruhsat alanlarını çıkarır.
/// </summary>
public static partial class RuhsatTextParser
{
    private static readonly string[] Brands =
    [
        "ALFA ROMEO", "ASTON MARTIN", "AUDI", "BENTLEY", "BMW", "BYD", "CHERY", "CHEVROLET",
        "CHRYSLER", "CITROEN", "CITROËN", "CUPRA", "DACIA", "DAEWOO", "DODGE", "DS", "FERRARI",
        "FIAT", "FORD", "HONDA", "HYUNDAI", "INFINITI", "ISUZU", "IVECO", "JAGUAR", "JEEP", "KIA",
        "LADA", "LAMBORGHINI", "LANCIA", "LAND ROVER", "LEXUS", "MASERATI", "MAZDA", "MERCEDES-BENZ",
        "MERCEDES BENZ", "MERCEDES", "MG", "MINI", "MITSUBISHI", "NISSAN", "OPEL", "PEUGEOT",
        "PORSCHE", "RENAULT", "SEAT", "SKODA", "ŠKODA", "SMART", "SSANGYONG", "SUBARU", "SUZUKI",
        "TESLA", "TOYOTA", "VOLKSWAGEN", "VW", "VOLVO",
    ];

    private static readonly HashSet<string> Colors = new(StringComparer.OrdinalIgnoreCase)
    {
        "BEYAZ", "SIYAH", "SİYAH", "GRI", "GRİ", "GUMUS", "GÜMÜŞ", "MAVI", "MAVİ", "LACIVERT",
        "LACİVERT", "KIRMIZI", "BORDO", "YESIL", "YEŞİL", "SARI", "TURUNCU", "MOR", "PEMBE",
        "BEJ", "KAHVERENGI", "KAHVERENGİ", "TURKUAZ", "FUME", "FÜME", "ANTRASIT", "ANTRASİT",
    };

    private static readonly HashSet<string> LabelNoise = new(StringComparer.OrdinalIgnoreCase)
    {
        "MARKASI", "TICARI", "TİCARİ", "ADI", "PLAKA", "MODEL", "YILI", "RENGI", "RENGİ",
        "YAKIT", "CINSI", "CİNSİ", "SASI", "ŞASİ", "MOTOR", "SILINDIR", "SİLİNDİR", "HACMI",
        "HACMİ", "NO", "NUMARASI",
    };

    public static ParsedRuhsat Parse(string? rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return ParsedRuhsat.Empty;

        var text = rawText.Replace('\r', '\n');
        var folded = FoldTr(text);

        var plate = ExtractPlate(text, folded);
        var brand = ExtractBrand(text, folded);
        var model = ExtractModel(text, folded, brand);
        var year = ExtractYear(text, folded);
        var color = ExtractColor(text, folded, brand);
        var fuel = ExtractFuel(text, folded);
        var chassis = ExtractChassis(text);
        var engineNo = ExtractEngineNo(text, folded, chassis);
        var engineVolume = ExtractEngineVolume(text, folded);

        return new ParsedRuhsat(plate, brand, model, year, color, fuel, chassis, engineNo, engineVolume);
    }

    public static bool HasUsefulFields(ParsedRuhsat p) =>
        !string.IsNullOrWhiteSpace(p.Plate)
        || (!string.IsNullOrWhiteSpace(p.Brand) && !string.IsNullOrWhiteSpace(p.Model))
        || !string.IsNullOrWhiteSpace(p.Chassis);

    private static string ExtractPlate(string text, string folded)
    {
        // Tip onay TR 2007/46 plaka değildir
        var candidates = PlateRegex().Matches(text)
            .Select(m => NormalizePlate(m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value))
            .Where(p => !p.StartsWith("TR ", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var after = AfterLabel(text, folded, ["(A)", "A)", "PLAKA NO", "PLAKA"]);
        if (!string.IsNullOrWhiteSpace(after))
        {
            var m = PlateRegex().Match(after);
            if (m.Success)
                return NormalizePlate(m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
        }

        return candidates.FirstOrDefault() ?? "";
    }

    private static string ExtractBrand(string text, string folded)
    {
        var after = AfterLabel(text, folded, ["(D.1)", "D.1", "MARKASI", "MARKA"]);
        if (!string.IsNullOrWhiteSpace(after))
        {
            var known = MatchKnownBrand(after);
            if (!string.IsNullOrEmpty(known)) return known;
            var token = FirstToken(after);
            if (!IsNoise(token) && !Colors.Contains(token))
                return ToTitle(token);
        }

        foreach (var b in Brands.OrderByDescending(x => x.Length))
        {
            if (folded.Contains(FoldTr(b)))
                return b == "VW" ? "Volkswagen" : ToTitle(b.Replace("CITROËN", "CITROEN").Replace("ŠKODA", "SKODA"));
        }
        return "";
    }

    private static string ExtractModel(string text, string folded, string brand)
    {
        var after = AfterLabel(text, folded, ["(D.3)", "D.3", "TICARI ADI", "TİCARİ ADI", "TICARIADI"]);
        if (!string.IsNullOrWhiteSpace(after))
        {
            var line = after.Split('\n')[0].Trim();
            line = Regex.Replace(line, @"^(T[Iİ]CAR[Iİ]\s*ADI|MODEL)\s*[:.\-]?\s*", "", RegexOptions.IgnoreCase);
            var token = FirstMeaningful(line);
            if (!string.IsNullOrEmpty(token) && !IsNoise(token) && !IsSameBrand(token, brand) && !Colors.Contains(token))
                return token;
        }
        return "";
    }

    private static string ExtractYear(string text, string folded)
    {
        var after = AfterLabel(text, folded, ["(D.4)", "D.4", "MODEL YILI", "MODELYILI"]);
        if (!string.IsNullOrWhiteSpace(after))
        {
            var m = YearRegex().Match(after);
            if (m.Success) return m.Value;
        }
        var years = YearRegex().Matches(text).Select(x => x.Value).Where(y =>
        {
            if (!int.TryParse(y, out var n)) return false;
            return n is >= 1985 and <= 2035;
        }).ToList();
        return years.LastOrDefault() ?? "";
    }

    private static string ExtractColor(string text, string folded, string brand)
    {
        var after = AfterLabel(text, folded, ["(R)", "RENGI", "RENGİ", "RENK"]);
        if (!string.IsNullOrWhiteSpace(after))
        {
            var token = FirstToken(after);
            if (!IsSameBrand(token, brand) && !IsNoise(token))
                return ToTitle(token);
        }
        foreach (var c in Colors)
        {
            if (folded.Contains(FoldTr(c)))
                return ToTitle(c);
        }
        return "";
    }

    private static string ExtractFuel(string text, string folded)
    {
        var after = AfterLabel(text, folded, ["YAKIT CINSI", "YAKIT CİNSİ", "YAKITI", "YAKIT"]);
        var src = string.IsNullOrWhiteSpace(after) ? folded : FoldTr(after);
        if (src.Contains("ELEKTRIK") || src.Contains("ELEKTRİK")) return "Elektrik";
        if (src.Contains("HIBRIT") || src.Contains("HİBRİT") || src.Contains("HYBRID")) return "Hibrit";
        if (src.Contains("LPG")) return "LPG";
        if (src.Contains("DIZEL") || src.Contains("DİZEL") || src.Contains("DIESEL")) return "Dizel";
        if (src.Contains("BENZIN") || src.Contains("BENZİN")) return "Benzin";
        return "";
    }

    private static string ExtractChassis(string text)
    {
        var after = AfterLabel(text, FoldTr(text), ["(E)", "SASI NO", "ŞASİ NO", "SASI", "ŞASİ", "VIN"]);
        var search = string.IsNullOrWhiteSpace(after) ? text : after;
        var m = VinRegex().Match(search.ToUpperInvariant());
        return m.Success ? m.Groups[1].Value : "";
    }

    private static string ExtractEngineNo(string text, string folded, string chassis)
    {
        var after = AfterLabel(text, folded, ["(P.5)", "P.5", "MOTOR NO", "MOTOR NUMARASI"]);
        if (string.IsNullOrWhiteSpace(after)) return "";
        var token = Regex.Replace(FirstToken(after), @"[^A-Za-z0-9\-]", "").ToUpperInvariant();
        if (token.Length < 4 || IsNoise(token)) return "";
        if (!string.IsNullOrEmpty(chassis) && token == chassis) return "";
        return token;
    }

    private static string ExtractEngineVolume(string text, string folded)
    {
        var after = AfterLabel(text, folded, ["(P.1)", "P.1", "SILINDIR HACMI", "SİLİNDİR HACMİ", "HACMI", "HACMİ"]);
        var search = string.IsNullOrWhiteSpace(after) ? text : after;
        var m = VolumeRegex().Match(search);
        return m.Success ? m.Groups[1].Value : "";
    }

    private static string AfterLabel(string text, string folded, IEnumerable<string> labels)
    {
        foreach (var label in labels)
        {
            var needle = FoldTr(label);
            var idx = folded.IndexOf(needle, StringComparison.Ordinal);
            if (idx < 0) continue;
            var after = text[(idx + needle.Length)..];
            after = Regex.Replace(after, @"^[\s:.\-–—]+", "");
            return after;
        }
        return "";
    }

    private static string MatchKnownBrand(string s)
    {
        var f = FoldTr(s);
        foreach (var b in Brands.OrderByDescending(x => x.Length))
        {
            if (f.StartsWith(FoldTr(b), StringComparison.Ordinal))
                return b == "VW" ? "Volkswagen" : ToTitle(b.Replace("CITROËN", "CITROEN").Replace("ŠKODA", "SKODA"));
        }
        return "";
    }

    private static string FirstToken(string s)
    {
        var line = s.Split('\n')[0];
        var parts = Regex.Split(line.Trim(), @"\s{2,}|\t| {2,}");
        var token = (parts.Length > 0 ? parts[0] : line).Trim();
        return token.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
    }

    private static string FirstMeaningful(string line)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var buf = new List<string>();
        foreach (var p in parts)
        {
            if (IsNoise(p)) continue;
            buf.Add(p);
            if (buf.Count >= 3) break;
        }
        return string.Join(' ', buf);
    }

    private static string NormalizePlate(string city, string letters, string digits) =>
        $"{city.Trim()} {letters.Trim().ToUpperInvariant()} {digits.Trim()}";

    private static string FoldTr(string s)
    {
        var u = s.Replace('i', 'İ').Replace('ı', 'I').ToUpper(new CultureInfo("tr-TR"));
        return u.Replace('İ', 'I').Replace('Ş', 'S').Replace('Ğ', 'G').Replace('Ü', 'U')
            .Replace('Ö', 'O').Replace('Ç', 'C');
    }

    private static bool IsNoise(string s) =>
        string.IsNullOrWhiteSpace(s) || LabelNoise.Contains(s) || FoldTr(s) is "ICARI" or "TICARI";

    private static bool IsSameBrand(string token, string brand) =>
        !string.IsNullOrEmpty(brand) && FoldTr(token) == FoldTr(brand);

    private static string ToTitle(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        var ti = new CultureInfo("tr-TR").TextInfo;
        return ti.ToTitleCase(s.ToLower(new CultureInfo("tr-TR")));
    }

    [GeneratedRegex(@"\b(0[1-9]|[1-7][0-9]|8[01])\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,4})\b", RegexOptions.IgnoreCase)]
    private static partial Regex PlateRegex();

    [GeneratedRegex(@"\b(19[8-9]\d|20[0-3]\d)\b")]
    private static partial Regex YearRegex();

    [GeneratedRegex(@"\b([A-HJ-NPR-Z0-9]{17})\b", RegexOptions.IgnoreCase)]
    private static partial Regex VinRegex();

    [GeneratedRegex(@"\b(1\d{3}|[2-9]\d{2,3})\s*(?:cm3|cm³|cc)?\b", RegexOptions.IgnoreCase)]
    private static partial Regex VolumeRegex();
}

public readonly record struct ParsedRuhsat(
    string Plate,
    string Brand,
    string Model,
    string Year,
    string Color,
    string Fuel,
    string Chassis,
    string EngineNo,
    string EngineVolume)
{
    public static ParsedRuhsat Empty => new("", "", "", "", "", "", "", "", "");
}
