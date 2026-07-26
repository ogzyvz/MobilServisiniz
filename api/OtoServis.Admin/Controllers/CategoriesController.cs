using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Filters;
using OtoServis.Admin.Models;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

[Authorize]
[RequireShop]
public class CategoriesController(AdminDataService data) : Controller
{
    public async Task<IActionResult> Index()
    {
        var vm = new CategoriesIndexViewModel
        {
            StockCategories = await data.GetStockCategoriesAsync(),
            ServiceCategories = await data.GetServiceCategoriesAsync(),
        };
        return View(vm);
    }

    [HttpGet]
    public IActionResult CreateStock()
    {
        return View("Form", new CategoryFormViewModel { Kind = "stock" });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateStock(CategoryFormViewModel model)
    {
        model.Kind = "stock";
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.CreateStockCategoryAsync(model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Kayıt oluşturulamadı.");
            return View("Form", model);
        }

        TempData["Success"] = "Stok kategorisi eklendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> EditStock(string code)
    {
        var model = await data.GetStockCategoryFormAsync(code);
        if (model is null) return NotFound();
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditStock(string code, CategoryFormViewModel model)
    {
        model.OriginalCode = code;
        model.Kind = "stock";
        model.Code = code;
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.UpdateStockCategoryAsync(code, model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Güncelleme başarısız.");
            return View("Form", model);
        }

        TempData["Success"] = "Stok kategorisi güncellendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeactivateStock(string code)
    {
        var (ok, error) = await data.DeactivateStockCategoryAsync(code);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Stok kategorisi silindi."
            : error ?? "Stok kategorisi silinemedi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public IActionResult CreateService()
    {
        return View("Form", new CategoryFormViewModel { Kind = "service" });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateService(CategoryFormViewModel model)
    {
        model.Kind = "service";
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.CreateServiceCategoryAsync(model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Kayıt oluşturulamadı.");
            return View("Form", model);
        }

        TempData["Success"] = "Servis kategorisi eklendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> EditService(string code)
    {
        var model = await data.GetServiceCategoryFormAsync(code);
        if (model is null) return NotFound();
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditService(string code, CategoryFormViewModel model)
    {
        model.OriginalCode = code;
        model.Kind = "service";
        model.Code = code;
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.UpdateServiceCategoryAsync(code, model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Güncelleme başarısız.");
            return View("Form", model);
        }

        TempData["Success"] = "Servis kategorisi güncellendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeactivateService(string code)
    {
        var (ok, error) = await data.DeactivateServiceCategoryAsync(code);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Servis kategorisi silindi."
            : error ?? "Servis kategorisi silinemedi.";
        return RedirectToAction(nameof(Index));
    }
}
