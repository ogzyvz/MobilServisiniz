using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Filters;
using OtoServis.Admin.Models;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

[Authorize]
[RequireShop]
public class CustomersController(AdminDataService data) : Controller
{
    public async Task<IActionResult> Index(string? search)
    {
        var items = await data.GetCustomersAsync(search);
        return View(new CustomersIndexViewModel { Search = search, Items = items });
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        return View("Form", new CustomerFormViewModel
        {
            CustomerTypes = await data.GetCustomerTypesAsync(),
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CustomerFormViewModel model)
    {
        model.CustomerTypes = await data.GetCustomerTypesAsync();
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.CreateCustomerAsync(model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Kayıt oluşturulamadı.");
            return View("Form", model);
        }

        TempData["Success"] = "Müşteri başarıyla eklendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id)
    {
        var model = await data.GetCustomerFormAsync(id);
        if (model is null) return NotFound();
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(Guid id, CustomerFormViewModel model)
    {
        model.Id = id;
        model.CustomerTypes = await data.GetCustomerTypesAsync();
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.UpdateCustomerAsync(id, model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Güncelleme başarısız.");
            return View("Form", model);
        }

        TempData["Success"] = "Müşteri bilgileri güncellendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await data.DeleteCustomerAsync(id);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Müşteri silindi."
            : "Müşteri silinemedi veya bulunamadı.";
        return RedirectToAction(nameof(Index));
    }
}
