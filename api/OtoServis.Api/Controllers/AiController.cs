using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Api.Models;
using OtoServis.Api.Services;

namespace OtoServis.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController(AiScanService ai, InvoiceScanService invoice, PlanEntitlementsService plans) : ControllerBase
{
    [HttpPost("scan-ruhsat")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<ActionResult<RuhsatScanResponse>> ScanRuhsat(
        [FromBody] ScanRuhsatRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ImageBase64))
            return BadRequest(new { error = "Fotoğraf verisi gerekli." });

        try
        {
            await plans.RequireFeatureAsync("ai_ruhsat");
            var result = await ai.ScanRuhsatAsync(
                req.ImageBase64,
                req.MimeType ?? "image/jpeg",
                ct);
            return Ok(result);
        }
        catch (PlanFeatureDeniedException ex) { return ex.ToActionResult(); }
        catch (AiScanException ex)
        {
            return StatusCode((int)ex.Status, new { error = ex.Message });
        }
    }

    [HttpPost("scan-invoice")]
    [RequestSizeLimit(14 * 1024 * 1024)]
    public async Task<ActionResult<InvoiceScanResponse>> ScanInvoice(
        [FromBody] ScanInvoiceRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.FileBase64))
            return BadRequest(new { error = "PDF verisi gerekli." });

        try
        {
            await plans.RequireFeatureAsync("ai_invoice");
            var result = await invoice.ScanAsync(req.FileBase64, req.MimeType ?? "application/pdf", ct);
            return Ok(result);
        }
        catch (PlanFeatureDeniedException ex) { return ex.ToActionResult(); }
        catch (AiScanException ex)
        {
            return StatusCode((int)ex.Status, new { error = ex.Message });
        }
    }
}
