using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Filters;
using OtoServis.Admin.Models;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

[Authorize]
[RequireShop]
public class SuppliersController(AdminDataService data) : Controller
{
    public async Task<IActionResult> Index(string? search)
    {
        var items = await data.GetSuppliersAsync(search);
        return View(new SuppliersIndexViewModel { Search = search, Items = items });
    }

    [HttpGet]
    public IActionResult Create()
    {
        return View("Form", new SupplierFormViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(SupplierFormViewModel model)
    {
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.CreateSupplierAsync(model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Kayıt oluşturulamadı.");
            return View("Form", model);
        }

        TempData["Success"] = "Cari başarıyla eklendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id)
    {
        var model = await data.GetSupplierFormAsync(id);
        if (model is null) return NotFound();
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(Guid id, SupplierFormViewModel model)
    {
        model.Id = id;
        if (!ModelState.IsValid) return View("Form", model);

        var (ok, error) = await data.UpdateSupplierAsync(id, model);
        if (!ok)
        {
            ModelState.AddModelError(string.Empty, error ?? "Güncelleme başarısız.");
            return View("Form", model);
        }

        TempData["Success"] = "Cari bilgileri güncellendi.";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Ledger(Guid id)
    {
        var model = await data.GetSupplierLedgerAsync(id);
        if (model is null) return NotFound();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RecordPayment(RecordPaymentViewModel model)
    {
        if (!ModelState.IsValid)
        {
            TempData["Error"] = "Ödeme kaydedilemedi. Lütfen tutarı kontrol edin.";
            return RedirectToAction(nameof(Ledger), new { id = model.SupplierId });
        }

        var (ok, error) = await data.RecordPaymentAsync(model);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Ödeme kaydedildi."
            : error ?? "Ödeme kaydedilemedi.";
        return RedirectToAction(nameof(Ledger), new { id = model.SupplierId });
    }
}
