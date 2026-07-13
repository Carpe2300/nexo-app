$ErrorActionPreference = "Stop"

$repoDir = $PSScriptRoot
$git = "C:\Program Files\Git\cmd\git.exe"
$remote = "https://github.com/Carpe2300/nexo-app.git"

if (!(Test-Path $git)) {
  throw "No encuentro Git en $git"
}

Set-Location $repoDir

& $git config --global --add safe.directory ($repoDir -replace "\\", "/")

if (!(Test-Path ".git")) {
  & $git init
}

& $git branch -M main

$origin = (& $git remote 2>$null) -contains "origin"
if ($origin) {
  & $git remote set-url origin $remote
} else {
  & $git remote add origin $remote
}

& $git add .

$pending = & $git status --short
if ($pending) {
  & $git commit -m "Publish Nexo web app"
} else {
  Write-Host "No hay cambios nuevos para publicar."
}

& $git push -u origin main

Write-Host ""
Write-Host "Listo. Ahora activa GitHub Pages en:"
Write-Host "https://github.com/Carpe2300/nexo-app/settings/pages"
Write-Host ""
Write-Host "Source: Deploy from a branch"
Write-Host "Branch: main"
Write-Host "Folder: /root"
