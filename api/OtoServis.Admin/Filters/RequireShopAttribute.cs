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
        data.BindTenant(user);

        await next();
    }
}
