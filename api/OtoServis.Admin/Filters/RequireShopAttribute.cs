using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireShopAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new RedirectToActionResult("Login", "Account", null);
            return;
        }

        if (user.GetShopId() is null)
        {
            context.Result = new RedirectToActionResult("SelectShop", "Account", null);
            return;
        }

        var tenant = context.HttpContext.RequestServices.GetRequiredService<TenantContext>();
        var data = context.HttpContext.RequestServices.GetRequiredService<AdminDataService>();
        var auth = context.HttpContext.RequestServices.GetRequiredService<AuthService>();
        data.BindTenant(user);

        var shopId = user.GetShopId();
        if (shopId.HasValue)
        {
            var license = await auth.GetShopLicenseAsync(shopId.Value);
            if (license?.LicenseStatus == "expired")
            {
                await context.HttpContext.SignOutAsync(
                    Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme);
                context.HttpContext.Session.Clear();
                context.Result = new RedirectToActionResult("Login", "Account", new { expired = 1 });
                return;
            }

            context.HttpContext.Items["ShopLicense"] = license;

            await using var conn = await context.HttpContext.RequestServices
                .GetRequiredService<DbFactory>().OpenAsync();
            context.HttpContext.Items["PlanEntitlements"] =
                await PlanEntitlementsHelper.GetForShopAsync(conn, shopId.Value);
        }

        await next();
    }
}
