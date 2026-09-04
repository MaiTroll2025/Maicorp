# MAI Corp - Infrastructure Billing - One-shot deploy script
# Run from: D:\MAiCORP\maicorp
#
# Steps performed:
#   1. Link the local repo to your Supabase project
#   2. Apply database migrations 026 + 027 via psql (URL parsed from .env)
#   3. Set all required Supabase secrets
#   4. Deploy all 7 edge functions
#   5. Print next-step instructions for scheduling the cron
#
# Required before running:
#   * Supabase CLI installed: npm i -g supabase
#   * Logged in: npx supabase login
#   * .env contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
#
# You will be prompted for any value not in .env.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSCommandPath
Set-Location $root

function Read-DotEnv($path) {
  $env = @{}
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -gt 0) { $env[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim() }
  }
  return $env
}

Write-Host "==> Reading .env" -ForegroundColor Cyan
$envFile = Read-DotEnv (Join-Path $root '.env')
$supabaseUrl = $envFile['VITE_SUPABASE_URL']
$projectRef  = ($supabaseUrl -replace '^https://','' -replace '\.supabase\.co$','')

if (-not $projectRef) { Write-Error "Could not parse project ref from VITE_SUPABASE_URL"; exit 1 }
Write-Host "Project ref: $projectRef"

# 1) link
Write-Host "`n==> Link to Supabase project" -ForegroundColor Cyan
npx supabase link --project-ref $projectRef

# 2) migrations - use psql with the database connection string
Write-Host "`n==> Apply migrations 026 + 027 via psql" -ForegroundColor Cyan
$dbUrlPrompt = Read-Host "Paste your Supabase DATABASE URL (Settings -> Database -> Connection string -> URI, service_role)"
if (-not $dbUrlPrompt) { Write-Warning "Skipping psql apply (no DB URL). Apply supabase/migrations/026_infrastructure_coverage.sql and 027_infrastructure_coverage_rpcs.sql in the SQL editor." }
else {
  $env:PGPASSWORD = ([System.Uri]$dbUrlPrompt).Segments[-1].Trim(':/')
  $combined = Get-Content 'supabase\migrations\026_infrastructure_coverage.sql' -Raw
  $combined += "`n`n"
  $combined += Get-Content 'supabase\migrations\027_infrastructure_coverage_rpcs.sql' -Raw
  $tmp = Join-Path $env:TEMP 'mai-infr-combined.sql'
  Set-Content -LiteralPath $tmp -Value $combined
  & psql ($dbUrlPrompt -replace '\?.*$','') -f $tmp -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { Write-Error "psql failed"; exit 1 }
}

# 3) secrets
Write-Host "`n==> Set secrets" -ForegroundColor Cyan
function Set-Secret($name, $prompt) {
  $existing = npx supabase secrets get $name 2>$null
  if ($LASTEXITCODE -eq 0 -and $existing) {
    Write-Host "  $name already set, skipping"
    return
  }
  $val = Read-Host $prompt
  if ($val) { npx supabase secrets set "$name=$val" | Out-Null }
}

Set-Secret 'PAYPAL_CLIENT_ID'        'PAYPAL_CLIENT_ID (paypal live client id)'
Set-Secret 'PAYPAL_CLIENT_SECRET'    'PAYPAL_CLIENT_SECRET (paypal live secret)'
Set-Secret 'PAYPAL_WEBHOOK_ID'        'PAYPAL_WEBHOOK_ID (paypal webhook id)'
Set-Secret 'RESEND_API_KEY'           'RESEND_API_KEY (resend.com api key)'
Set-Secret 'MAIL_FROM'                'MAIL_FROM (press Enter to default: MAI Corp <billing@mai-corp.com>)'
if (-not $envFile['MAIL_FROM_SET']) {
  if ($LASTEXITCODE -ne 0) { npx supabase secrets set "MAIL_FROM=MAI Corp <billing@mai-corp.com>" | Out-Null }
}
npx supabase secrets set 'PUBLIC_SITE_URL=https://maicorp.online' | Out-Null
npx supabase secrets set 'CRON_SECRET=199519951903190310031003' | Out-Null

# 4) deploy functions
Write-Host "`n==> Deploy edge functions" -ForegroundColor Cyan
foreach ($fn in @(
  'paypal-create','paypal-capture','paypal-webhook',
  'send-infrastructure-email',
  'infra-invoice-paypal-create','infra-invoice-paypal-capture',
  'run-infrastructure-billing-cron')) {
  Write-Host "  -> $fn"
  npx supabase functions deploy $fn --no-verify-jwt
}

Write-Host "`n==> All set." -ForegroundColor Green
Write-Host "Next: schedule the cron via either:" -ForegroundColor Yellow
Write-Host "  A) Supabase Dashboard -> Edge Functions -> run-infrastructure-billing-cron -> Schedule -> 0 6 * * *" -ForegroundColor Yellow
Write-Host "  B) Push the repo so .github/workflows/infra-billing-cron.yml runs daily." -ForegroundColor Yellow
Write-Host "Done."
