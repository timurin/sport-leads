$ErrorActionPreference = "Stop"

$projectRoot = Split-Path `
    -Parent `
    $PSScriptRoot

Set-Location $projectRoot

Write-Host ""
Write-Host "Sport Leads Project Check" `
    -ForegroundColor Cyan

Write-Host "Project: $projectRoot"
Write-Host ""

python scripts\check_project.py

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Проверка завершилась с ошибкой." `
        -ForegroundColor Red

    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Все проверки успешно пройдены." `
    -ForegroundColor Green