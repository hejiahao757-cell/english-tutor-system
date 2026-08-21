param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
  [string]$Email,
  [string]$DisplayName = '老师',
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [string]$SupabaseHome = $env:SUPABASE_HOME,
  [string]$SupabaseProfile = 'supabase'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRef) { throw '请通过 SUPABASE_PROJECT_REF 或 -ProjectRef 指定项目引用。' }
if (-not $SupabaseHome) { $SupabaseHome = Join-Path $env:LOCALAPPDATA 'supabase' }
$projectUrl = "https://$ProjectRef.supabase.co"
$supabaseCli = Join-Path $projectRoot 'node_modules\@supabase\cli-windows-x64\bin\supabase.exe'

if (-not (Test-Path -LiteralPath $supabaseCli)) {
  throw "找不到项目内的 Supabase CLI：$supabaseCli"
}
$env:SUPABASE_HOME = $SupabaseHome

Push-Location $projectRoot
try {
  $rawKeys = & $supabaseCli projects api-keys --project-ref $ProjectRef --profile $SupabaseProfile --output json
  if ($LASTEXITCODE -ne 0) { throw '无法读取 Supabase 管理密钥。' }
  $serviceRole = ($rawKeys | ConvertFrom-Json | Where-Object { $_.name -eq 'service_role' }).api_key
  if (-not $serviceRole) { throw 'Supabase 未返回 service_role 密钥。' }

  $randomBytes = [byte[]]::new(24)
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
  $temporaryPassword = ([Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')) + 'a1!'

  $body = @{
    email = $Email.Trim().ToLowerInvariant()
    password = $temporaryPassword
    email_confirm = $true
    app_metadata = @{ app_role = 'teacher' }
    user_metadata = @{ display_name = $DisplayName.Trim() }
  } | ConvertTo-Json -Depth 5
  $curlArgs = @(
    '--silent', '--show-error', '--fail-with-body', '--request', 'POST',
    '--header', "apikey: $serviceRole",
    '--header', "Authorization: Bearer $serviceRole",
    '--header', 'Content-Type: application/json',
    '--header', 'Accept: application/json',
    '--data-binary', '@-',
    "$projectUrl/auth/v1/admin/users"
  )
  $previousOutputEncoding = $OutputEncoding
  try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $createdJson = $body | & curl.exe @curlArgs
  } finally { $OutputEncoding = $previousOutputEncoding }
  if ($LASTEXITCODE -ne 0) { throw "教师账号创建请求失败：$createdJson" }
  $created = $createdJson | ConvertFrom-Json
  if (-not $created.id) { throw '教师账号创建后未返回用户 ID。' }

  $profileBody = @{ role = 'teacher'; student_code = $null } | ConvertTo-Json -Compress
  $profileCurlArgs = @(
    '--silent', '--show-error', '--fail-with-body', '--request', 'PATCH',
    '--header', "apikey: $serviceRole",
    '--header', "Authorization: Bearer $serviceRole",
    '--header', 'Content-Type: application/json',
    '--header', 'Accept: application/json',
    '--header', 'Prefer: return=representation',
    '--data-binary', '@-',
    "$projectUrl/rest/v1/profiles?id=eq.$($created.id)"
  )
  $previousOutputEncoding = $OutputEncoding
  try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $profileJson = $profileBody | & curl.exe @profileCurlArgs
  } finally { $OutputEncoding = $previousOutputEncoding }
  if ($LASTEXITCODE -ne 0) { throw "教师资料角色校正失败：$profileJson" }
  $updatedProfiles = @($profileJson | ConvertFrom-Json)
  if ($updatedProfiles.Count -ne 1 -or $updatedProfiles[0].role -ne 'teacher') {
    throw '教师资料角色校正后未返回唯一的 teacher 记录。'
  }

  $securePassword = ConvertTo-SecureString -String $temporaryPassword -AsPlainText -Force
  $encryptedRecord = @{
    email = $Email.Trim().ToLowerInvariant()
    displayName = $DisplayName.Trim()
    encryptedPassword = ConvertFrom-SecureString -SecureString $securePassword
    createdAt = (Get-Date).ToString('o')
  } | ConvertTo-Json
  $credentialDirectory = Join-Path $projectRoot 'supabase\.temp'
  New-Item -ItemType Directory -Force -Path $credentialDirectory | Out-Null
  $credentialFile = Join-Path $credentialDirectory 'teacher-credentials.dpapi.json'
  Set-Content -LiteralPath $credentialFile -Value $encryptedRecord -Encoding utf8NoBOM

  [pscustomobject]@{
    UserId = $created.id
    Email = $Email.Trim().ToLowerInvariant()
    TemporaryPassword = $temporaryPassword
    EncryptedBackup = $credentialFile
  }
} finally { Pop-Location }

