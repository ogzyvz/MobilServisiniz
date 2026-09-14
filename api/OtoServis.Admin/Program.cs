using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using OtoServis.Admin.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<DbFactory>();
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AdminDataService>();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(opt =>
{
    opt.IdleTimeout = TimeSpan.FromHours(2);
    opt.Cookie.HttpOnly = true;
    opt.Cookie.IsEssential = true;
});

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

var app = builder.Build();

// Cloudflare/IIS arkasinda calisiyoruz: gercek istek https olsa da IIS'e ulasan
// baglanti bazen http gorunebilir, bu da login yonlendirmelerinin "http://" ile
// olusturulmasina (guvensiz sayfa / olasi yonlendirme dongusu) yol aciyordu.
// X-Forwarded-Proto/X-Forwarded-For'u okuyup Request.Scheme'i duzeltiyoruz.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    KnownNetworks = { },
    KnownProxies = { },
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Dashboard}/{action=Index}/{id?}");

app.Run();
