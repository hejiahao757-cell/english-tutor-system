$ErrorActionPreference = 'Stop'

$url = 'http://127.0.0.1:5173'
$edgeCandidates = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
$edge = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw '没有找到 Microsoft Edge。' }

function Test-TutorServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-TutorServer)) {
  $shell = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
  if (-not $shell) { $shell = (Get-Command powershell.exe).Source }
  $serverScript = Join-Path $PSScriptRoot 'Start-Tutor-Server.ps1'
  Start-Process -FilePath $shell `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$serverScript`"") `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Hidden

  $ready = $false
  foreach ($attempt in 1..40) {
    Start-Sleep -Milliseconds 250
    if (Test-TutorServer) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Tutor 启动超时，请检查 Node.js 环境。' }
}

Start-Process -FilePath $edge -ArgumentList "--app=$url"

