using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Platform.Filters;
using OtoServis.Platform.Models;
using OtoServis.Platform.Services;

namespace OtoServis.Platform.Controllers;

[Authorize]
[RequirePlatformAdmin]
public class AppReleaseController(PlatformDataService data) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        ViewData["Title"] = "Uygulama Sürümü";
        var form = await data.GetAppReleaseAsync() ?? new AppReleaseForm
        {
            LatestVersion = "1.0.19",
            LatestVersionCode = 20,
            MinVersionCode = 20,
        };
        form.ForceThisVersion = form.MinVersionCode >= form.LatestVersionCode;
        return View(form);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(AppReleaseForm form)
    {
        ViewData["Title"] = "Uygulama Sürümü";
        if (!ModelState.IsValid)
            return View(form);

        try
        {
            await data.UpdateAppReleaseAsync(form);
            TempData["Flash"] = "Sürüm bilgisi güncellendi.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return View(form);
        }
    }
}
