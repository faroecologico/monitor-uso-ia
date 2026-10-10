# Crea un acceso directo en la carpeta de Inicio de Windows para que el monitor
# se abra al iniciar sesión. Para quitarlo: Win+R, shell:startup, y borrar el acceso.
$app = $PSScriptRoot
$electron = Join-Path $app 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { Write-Error 'Falta Electron: corre "npm install" primero.'; exit 1 }

$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'Monitor de uso IA.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = $electron
$s.Arguments = "`"$app`""
$s.WorkingDirectory = $app
$s.Description = 'Uso restante de Codex y Claude'
$s.Save()
"Listo: $lnk"
