@echo off
REM Wrapper to launch the PowerShell GUI script from Windows
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%manage_project.ps1"
pause
