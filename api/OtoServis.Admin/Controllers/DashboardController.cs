using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Filters;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

[Authorize]
[RequireShop]
public class DashboardController(AdminDataService data) : Controller
{
    public async Task<IActionResult> Index()
    {
        var model = await data.GetDashboardAsync();
        if (model is null)
        {
            ViewData["Error"] = "Dashboard verisi yüklenemedi.";
            model = new Models.DashboardViewModel { ShopName = User.GetShopName() ?? "" };
        }
        return View(model);
    }
}
