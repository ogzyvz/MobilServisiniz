@echo off
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5281
cd /d "%~dp0"
dotnet OtoServis.Admin.dll
