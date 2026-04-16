param(
    [string]$MigrationName = "init"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..\\..")
$schemaPath = Join-Path $rootDir "backend\\prisma\\schema.prisma"

if (-not $env:DB_URL) {
    throw "DB_URL is required. Example: postgresql://gigi:gigi@localhost:5432/gigi?schema=public"
}

$env:DATABASE_URL = $env:DB_URL

python -m prisma generate --schema $schemaPath
python -m prisma migrate dev --schema $schemaPath --name $MigrationName
