@echo off
rem Doble clic: abre la ventanita flotante. Se cierra con su X.
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" .
