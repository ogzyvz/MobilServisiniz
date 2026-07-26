using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Models;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

public class AccountController(AuthService auth) : Controller
{
    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true && User.GetShopId().HasValue)
            return RedirectToAction("Index", "Dashboard");
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel());
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> LookupTenant(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { error = "Servis kodu gerekli." });
        var shop = await auth.LookupTenantAsync(code);
        return shop is null ? NotFound(new { error = "Servis bulunamadı." }) : Ok(shop);
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
    {
        if (!ModelState.IsValid) return View(model);

        var preview = await auth.LookupTenantAsync(model.TenantCode);
        if (preview is null)
        {
            ModelState.AddModelError(nameof(model.TenantCode), "Servis kodu geçersiz.");
            return View(model);
        }
        model.ShopPreviewName = preview.ShopName;

        var result = await auth.ValidateAsync(model.TenantCode, model.Phone, model.Password);
        if (result is null)
        {
            ModelState.AddModelError(string.Empty, "Telefon, şifre veya servis yetkisi hatalı.");
            return View(model);
        }

        var (userId, fullName, shop) = result.Value;
        return await SignInShopAsync(userId, fullName, shop, returnUrl);
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        HttpContext.Session.Clear();
        return RedirectToAction(nameof(Login));
    }

    private async Task<IActionResult> SignInShopAsync(
        Guid userId, string fullName, ShopOption shop, string? returnUrl)
    {
        var principal = AuthService.BuildPrincipal(userId, fullName, shop);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            AuthService.SessionProps());

        HttpContext.Session.Clear();

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);
        return RedirectToAction("Index", "Dashboard");
    }
}
