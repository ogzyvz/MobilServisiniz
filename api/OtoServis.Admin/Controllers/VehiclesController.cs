using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OtoServis.Admin.Filters;
using OtoServis.Admin.Models;
using OtoServis.Admin.Services;

namespace OtoServis.Admin.Controllers;

[Authorize]
[RequireShop]
public class VehiclesController(AdminDataService data) : Controller
{
    public async Task<IActionResult> Index(string? search, Guid? customerId)
    {
        var items = await data.GetVehiclesAsync(search, customerId);
        string? customerName = customerId.HasValue
            ? await data.GetCustomerNameAsync(customerId.Value)
            : null;

        return View(new VehiclesIndexViewModel
        {
            Search = search,
            CustomerId = customerId,
            CustomerName = customerName,
            Items = items,
        });
    }

    [HttpGet]
    public async Task<IActionResult> Create(Guid? customerId)
    {
        var model = new VehicleFormViewModel
        {
            Customers = await data.GetCustomerSelectListAsync(),
            FuelTypes = await data.GetFuelTypesAsync(),
        };
        if (customerId.HasValue) model.CustomerId = customerId.Value;
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(VehicleFormViewModel form)
    {
        form.Customers = await data.GetCustomerSelectListAsync();
        form.FuelTypes = await data.GetFuelTypesAsync();
        if (!ModelState.IsValid) return View("Form", form);

        var (ok, error, conflictVehicleId, conflictOwnerName) = await data.CreateVehicleAsync(form);
        if (!ok)
        {
            if (conflictVehicleId.HasValue)
            {
                form.ConflictVehicleId = conflictVehicleId;
                form.ConflictOwnerName = conflictOwnerName;
            }
            else
            {
                ModelState.AddModelError(string.Empty, error ?? "Kayıt oluşturulamadı.");
            }
            return View("Form", form);
        }

        TempData["Success"] = "Araç başarıyla eklendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id)
    {
        var model = await data.GetVehicleFormAsync(id);
        if (model is null) return NotFound();
        return View("Form", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(Guid id, VehicleFormViewModel form)
    {
        form.Id = id;
        form.Customers = await data.GetCustomerSelectListAsync();
        form.FuelTypes = await data.GetFuelTypesAsync();
        if (!ModelState.IsValid) return View("Form", form);

        var (ok, error, conflictVehicleId, conflictOwnerName) = await data.UpdateVehicleAsync(id, form);
        if (!ok)
        {
            if (conflictVehicleId.HasValue)
            {
                form.ConflictVehicleId = conflictVehicleId;
                form.ConflictOwnerName = conflictOwnerName;
            }
            else
            {
                ModelState.AddModelError(string.Empty, error ?? "Güncelleme başarısız.");
            }
            return View("Form", form);
        }

        TempData["Success"] = "Araç bilgileri güncellendi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await data.DeleteVehicleAsync(id);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Araç silindi."
            : "Araç silinemedi veya bulunamadı.";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Transfer(Guid id)
    {
        var model = await data.GetVehicleTransferAsync(id);
        if (model is null) return NotFound();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Transfer(VehicleTransferViewModel model)
    {
        if (!ModelState.IsValid)
        {
            model.Customers = await data.GetCustomerSelectListAsync();
            return View(model);
        }

        var (ok, error) = await data.TransferVehicleAsync(model.VehicleId, model.NewCustomerId);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Araç devredildi."
            : error ?? "Araç devredilemedi.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> TransferOnConflict(Guid conflictVehicleId, Guid newCustomerId)
    {
        var (ok, error) = await data.TransferVehicleAsync(conflictVehicleId, newCustomerId);
        TempData[ok ? "Success" : "Error"] = ok
            ? "Araç devredildi."
            : error ?? "Araç devredilemedi.";
        return RedirectToAction(nameof(Edit), new { id = conflictVehicleId });
    }
}
