param(
    [string]$Script = "script.js",
    [int]$VUs = 5,
    [string]$Duration = "30s",
    [string]$Output = "influxdb=http://influxdb:8086/k6"
)

Write-Host "🚀 Starting k6 test..." -ForegroundColor Green
Write-Host "📝 Script: $Script" -ForegroundColor Yellow
Write-Host "👤 VUs: $VUs" -ForegroundColor Yellow
Write-Host "⏱️ Duration: $Duration" -ForegroundColor Yellow

# Check if script exists
if (-not (Test-Path "scripts\$Script")) {
    Write-Host "❌ Script not found: scripts\$Script" -ForegroundColor Red
    exit 1
}

# Run k6
docker exec -it k6 k6 run `
    --vus $VUs `
    --duration $Duration `
    --out $Output `
    "/scripts/$Script"

Write-Host "✅ Test completed!" -ForegroundColor Green
Write-Host "📊 Check Grafana at http://localhost:3000" -ForegroundColor Green