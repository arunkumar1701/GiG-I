param(
    [string]$ProjectRoot = "D:\downloads\GiG-I-main\GiG-I-main",
    [string]$ProjectId = "gig-i-a4fea",
    [string]$Region = "asia-south1",
    [string]$TempRoot = "D:\gcloud-temp",
    [string]$CloudSdkConfig = "D:\gcloud-config",
    [string]$NpmCache = "D:\npm-cache"
)

$ErrorActionPreference = "Stop"

foreach ($path in @($TempRoot, $CloudSdkConfig, $NpmCache)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

$env:TEMP = $TempRoot
$env:TMP = $TempRoot
$env:TMPDIR = $TempRoot
$env:CLOUDSDK_CONFIG = $CloudSdkConfig
$env:npm_config_cache = $NpmCache

Set-Location -LiteralPath $ProjectRoot

Write-Host "Using TEMP=$env:TEMP"
Write-Host "Using CLOUDSDK_CONFIG=$env:CLOUDSDK_CONFIG"
Write-Host "Submitting Cloud Build from $ProjectRoot"

gcloud config set project $ProjectId
gcloud builds submit `
    --config cloudbuild.yaml `
    --project $ProjectId `
    --region $Region `
    .
