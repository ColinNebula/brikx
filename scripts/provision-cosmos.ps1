param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroup,

  [Parameter(Mandatory = $true)]
  [string]$AccountName,

  [string]$DatabaseName = "brikx",
  [string]$ContainerName = "leaderboard"
)

$ErrorActionPreference = "Stop"

Write-Host "Provisioning Cosmos DB SQL database/container for leaderboard..." -ForegroundColor Cyan

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) is required. Install it first: https://aka.ms/installazurecliwindows"
}

$policyPath = Join-Path $PSScriptRoot "cosmos-indexing-policy.json"

if (-not (Test-Path $policyPath)) {
  throw "Missing indexing policy file at $policyPath"
}

Write-Host "Ensuring SQL database '$DatabaseName' exists..." -ForegroundColor Yellow
az cosmosdb sql database create `
  --resource-group $ResourceGroup `
  --account-name $AccountName `
  --name $DatabaseName `
  --only-show-errors | Out-Null

Write-Host "Ensuring SQL container '$ContainerName' exists with tuned indexing policy..." -ForegroundColor Yellow
az cosmosdb sql container create `
  --resource-group $ResourceGroup `
  --account-name $AccountName `
  --database-name $DatabaseName `
  --name $ContainerName `
  --partition-key-path "/docType" `
  --idx "@$policyPath" `
  --default-ttl -1 `
  --only-show-errors | Out-Null

Write-Host "Done. Cosmos DB leaderboard container is provisioned." -ForegroundColor Green
Write-Host ""
Write-Host "Recommended app settings for Static Web Apps:" -ForegroundColor Cyan
Write-Host "COSMOSDB_ENDPOINT=<your account endpoint>"
Write-Host "COSMOSDB_KEY=<your account key>"
Write-Host "COSMOSDB_DATABASE=$DatabaseName"
Write-Host "COSMOSDB_CONTAINER=$ContainerName"
Write-Host "LEADERBOARD_SIGNING_SECRET=<random long secret>"
Write-Host "LEADERBOARD_ADMIN_KEY=<admin key for /api/leaderboard/admin>"
