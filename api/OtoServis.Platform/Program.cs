using Microsoft.AspNetCore.Authentication.Cookies;
using OtoServis.Platform.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<DbFactory>();
builder.Services.AddScoped<PlatformAuthService>();
builder.Services.AddScoped<PlatformDataService>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.LoginPath = "/Account/Login";
        opt.LogoutPath = "/Account/Logout";
        opt.AccessDeniedPath = "/Account/Login";
        opt.ExpireTimeSpan = TimeSpan.FromHours(12);
        opt.SlidingExpiration = true;
    });

builder.Services.AddControllersWithViews();
builder.Services.AddAuthorization();
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(opt =>
{
    opt.MultipartBodyLengthLimit = 120_000_000;
});
builder.WebHost.ConfigureKestrel(opt =>
{
    opt.Limits.MaxRequestBodySize = 120_000_000;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Account/Login");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Shops}/{action=Index}/{id?}");

app.Run();
