@echo off
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5282
cd /d "%~dp0"
dotnet OtoServis.Platform.dll
