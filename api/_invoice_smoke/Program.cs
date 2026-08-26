using OtoServis.Api.Services;
foreach (var path in new[] {
  @"c:\Users\oguz.yavuz\Downloads\PDF ÖRNEK 4.pdf",
  @"c:\Users\oguz.yavuz\Downloads\PDF ÖRNEK.pdf",
})
{
  Console.WriteLine("==== " + Path.GetFileName(path) + " ====");
  var text = InvoiceTextParser.ExtractTextFromPdf(File.ReadAllBytes(path));
  var lines = text.Split('\n').Where(l => l.Trim().Length > 0).Take(40);
  foreach (var l in lines) Console.WriteLine(l);
  Console.WriteLine("--- PARSED ---");
  var parsed = InvoiceTextParser.Parse(text);
  Console.WriteLine($"Doc={parsed.DocumentNo} Date={parsed.DocumentDate} Count={parsed.Lines.Count}");
  foreach (var l in parsed.Lines.Take(15))
    Console.WriteLine($"  qty={l.Quantity} unit={l.UnitPrice} total={l.LineTotal} name={l.Name}");
  Console.WriteLine();
}
