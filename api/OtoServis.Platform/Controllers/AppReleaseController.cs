using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Platform.Filters;
using OtoServis.Platform.Models;
using OtoServis.Platform.Services;

namespace OtoServis.Platform.Controllers;

[Authorize]
[RequirePlatformAdmin]
public class AppReleaseController(PlatformDataService data, IConfiguration config) : Controller
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
    [RequestSizeLimit(120_000_000)]
    public async Task<IActionResult> Index(AppReleaseForm form, IFormFile? apkFile)
    {
        ViewData["Title"] = "Uygulama Sürümü";
        if (!ModelState.IsValid)
            return View(form);

        try
        {
            if (apkFile is { Length: > 0 })
            {
                var fileName = apkFile.FileName;
                if (!fileName.EndsWith(".apk", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Yalnızca .apk dosyası yüklenebilir.");

                var storagePath = config["AppRelease:StoragePath"]
                    ?? @"C:\OtoServis\api\wwwroot\releases";
                var publicBase = (config["AppRelease:PublicBaseUrl"]
                    ?? "http://37.148.211.243:5280/releases").TrimEnd('/');

                Directory.CreateDirectory(storagePath);
                var destName = "MobilServisiniz.apk";
                var destPath = Path.Combine(storagePath, destName);
                await using (var fs = System.IO.File.Create(destPath))
                {
                    await apkFile.CopyToAsync(fs);
                }

                form.ApkUrl = $"{publicBase}/{destName}";
            }

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
