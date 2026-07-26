@echo off
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5280
cd /d "%~dp0"
dotnet OtoServis.Api.dll
