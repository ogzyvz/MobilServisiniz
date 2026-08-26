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
        if (string.Equals(HttpContext.Request.Query["expired"], "1", StringComparison.Ordinal))
            ModelState.AddModelError(string.Empty,
                "Servis lisans süreniz dolmuştur. Yenileme için lütfen iletişime geçin.");
        return View(new LoginViewModel());
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
    {
        if (!ModelState.IsValid) return View(model);

        try
        {
            var result = await auth.ValidateAsync(model.Identifier, model.Password);
            if (result is null)
            {
                ModelState.AddModelError(string.Empty, "Telefon/kullanıcı adı veya şifre hatalı.");
                return View(model);
            }

            var (userId, fullName, shop) = result.Value;
            return await SignInShopAsync(userId, fullName, shop, returnUrl);
        }
        catch (ShopLicenseExpiredException ex)
        {
            ModelState.AddModelError(string.Empty, ex.Message);
            return View(model);
        }
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
