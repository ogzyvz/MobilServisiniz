using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace OtoServis.Api.Services;

public sealed record ParsedInvoiceLine(string Name, int Quantity, decimal UnitPrice, decimal LineTotal);

public sealed record ParsedInvoice(
    string? DocumentNo,
    string? DocumentDate,
    IReadOnlyList<ParsedInvoiceLine> Lines,
    string Provider);

public static class InvoiceTextParser
{
    /// <summary>Türkçe para: 150,00 / 7.400,00</summary>
    private static readonly Regex Money = new(
        @"\d{1,3}(?:\.\d{3})*,\d{2}",
        RegexOptions.Compiled);

    private static readonly Regex DocNoRx = new(
        @"Evrak\s*No\.?\s*(?<v>\d+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex DocDateRx = new(
        @"Evrak\s*Tarihi\s*(?<v>\d{2}\.\d{2}\.\d{4})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly HashSet<string> SkipStarts = new(StringComparer.OrdinalIgnoreCase)
    {
        "Evrak No", "Evrak Tarihi", "Ödeme Tarihi", "Nakli Yekün", "Toplam Tutar",
        "Evrak Yekünü", "Yalnız Yazı", "Stok Adı", "YETMİŞ", "İKİ BİN", "-- ",
    };

    public static string ExtractTextFromPdf(byte[] pdfBytes)
    {
        using var doc = PdfDocument.Open(pdfBytes);
        var sb = new StringBuilder();
        foreach (var page in doc.GetPages())
        {
            // Kelime konumuna göre satır birleştir (fatura tabloları için daha sağlam)
            var words = page.GetWords().ToList();
            if (words.Count == 0)
            {
                if (!string.IsNullOrWhiteSpace(page.Text))
                    sb.AppendLine(page.Text);
                continue;
            }

            var lines = words
                .GroupBy(w => (int)Math.Round(w.BoundingBox.Bottom / 2.0) * 2)
                .OrderByDescending(g => g.Key)
                .Select(g => string.Join(" ", g.OrderBy(w => w.BoundingBox.Left).Select(w => w.Text)))
                .ToList();

            foreach (var line in lines)
                sb.AppendLine(line);
            sb.AppendLine();
        }
        return sb.ToString();
    }

    public static ParsedInvoice Parse(string text)
    {
        var lines = new List<ParsedInvoiceLine>();
        string? docNo = null;
        string? docDate = null;

        foreach (var raw in text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var line = raw.Trim();
            if (line.Length < 8) continue;

            if (docNo is null)
            {
                var m = DocNoRx.Match(line);
                if (m.Success) docNo = m.Groups["v"].Value;
            }
            if (docDate is null)
            {
                var m = DocDateRx.Match(line);
                if (m.Success) docDate = m.Groups["v"].Value;
            }

            if (SkipStarts.Any(s => line.StartsWith(s, StringComparison.OrdinalIgnoreCase)))
                continue;
            if (line.Contains("Yekün", StringComparison.OrdinalIgnoreCase))
                continue;
            if (line.Contains("Lira", StringComparison.OrdinalIgnoreCase) && !Money.IsMatch(line))
                continue;

            var parsed = TryParseLine(line);
            if (parsed is not null)
                lines.Add(parsed);
        }

        return new ParsedInvoice(docNo, docDate, lines, "pdf-text");
    }

    private static ParsedInvoiceLine? TryParseLine(string line)
    {
        var moneyMatches = Money.Matches(line).Cast<Match>().ToList();
        if (moneyMatches.Count < 3) return null;

        // Parçacı faturaları: Stok Adı | Miktarı | Fiyat | Tutar
        // İsim içinde 0,20 / 7,80 gibi değerler olabildiği için SON 3 para birimini kullan.
        var qtyDec = ParseMoney(moneyMatches[^3].Value);
        var unit = ParseMoney(moneyMatches[^2].Value);
        var total = ParseMoney(moneyMatches[^1].Value);

        // Çapraz kontrol: qty×unit ≈ total değilse yaygın alternatif sırayı dene
        // (eski hatalı: birim, tutar, miktar)
        if (!LooksConsistent(qtyDec, unit, total))
        {
            var altUnit = ParseMoney(moneyMatches[^3].Value);
            var altTotal = ParseMoney(moneyMatches[^2].Value);
            var altQty = ParseMoney(moneyMatches[^1].Value);
            if (LooksConsistent(altQty, altUnit, altTotal))
            {
                qtyDec = altQty;
                unit = altUnit;
                total = altTotal;
            }
            else if (qtyDec >= 10 && unit > 0 && unit <= 20 && Math.Abs(total - qtyDec) < 0.05m)
            {
                // Klasik karışıklık: miktar↔birim (1,00 ile 7.400,00 yer değişmiş)
                (qtyDec, unit) = (unit, qtyDec);
            }
        }

        var qty = Math.Max(1, (int)Math.Round(qtyDec, MidpointRounding.AwayFromZero));
        if (unit <= 0 && total > 0) unit = Math.Round(total / qty, 2);
        if (unit <= 0) return null;
        if (total <= 0) total = Math.Round(unit * qty, 2);

        // Ürün adı: satırın son 3 para biriminden önceki kısım
        var cutAt = moneyMatches[^3].Index;
        var head = cutAt > 0 ? line[..cutAt].Trim() : line;
        // Sondaki yalnız sıra no kalmışsa at
        head = Regex.Replace(head, @"[\t ]+\d+\s*$", "").Trim();
        var name = CleanName(head);
        if (name.Length < 2) return null;

        return new ParsedInvoiceLine(name, qty, unit, total);
    }

    /// <summary>qty × unit ≈ total (küçük yuvarlama toleransı).</summary>
    private static bool LooksConsistent(decimal qty, decimal unit, decimal total)
    {
        if (qty <= 0 || unit <= 0 || total <= 0) return false;
        var expected = Math.Round(qty * unit, 2, MidpointRounding.AwayFromZero);
        var diff = Math.Abs(expected - total);
        // Mutlak 0.05 veya satır tutarının %1'i
        var tol = Math.Max(0.05m, Math.Round(total * 0.01m, 2));
        return diff <= tol;
    }

    private static string CleanName(string name)
    {
        name = name.Replace('\t', ' ').Trim();
        name = Regex.Replace(name, @"\s+", " ");
        // Baştaki satır no: "13 ISITMA..." → "ISITMA..."
        name = Regex.Replace(name, @"^\d{1,3}[\t ]+", "");
        // Kesilmiş parantezleri toparla
        if (name.EndsWith('(') || name.EndsWith('+'))
            name = name.TrimEnd('(', '+', ' ').Trim();
        return name;
    }

    public static decimal ParseMoney(string raw)
    {
        var s = raw.Trim().Replace(".", "").Replace(',', '.');
        return decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : 0;
    }
}
