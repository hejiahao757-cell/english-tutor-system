param(
  [string]$RceditPath = $env:ELECTRON_BUILDER_RCEDIT_PATH
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$electronDist = Join-Path $projectRoot 'node_modules\electron\dist'
$releaseFile = Join-Path $projectRoot 'release\Tutor-Test-0.1.0-Portable.exe'
$readyDirectory = Join-Path $projectRoot 'release-ready'

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '') }
    finally { $sha.Dispose() }
  } finally { $stream.Dispose() }
}

if (-not (Test-Path -LiteralPath (Join-Path $electronDist 'electron.exe'))) {
  throw "本地 Electron 运行时不完整：$electronDist"
}
if (-not $RceditPath -or -not (Test-Path -LiteralPath (Join-Path $RceditPath 'rcedit-x64.exe'))) {
  throw '请通过 ELECTRON_BUILDER_RCEDIT_PATH 或 -RceditPath 指定包含 rcedit-x64.exe 的目录。'
}

Push-Location $projectRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Web 生产构建失败。' }
  $env:ELECTRON_BUILDER_RCEDIT_PATH = $RceditPath
  npx electron-builder --win portable "--config.electronDist=$electronDist"
  if ($LASTEXITCODE -ne 0) { throw 'Windows 便携版封装失败。' }
  New-Item -ItemType Directory -Path $readyDirectory -Force | Out-Null
  $readyFile = Join-Path $readyDirectory (Split-Path -Leaf $releaseFile)
  Copy-Item -LiteralPath $releaseFile -Destination $readyFile -Force
  [pscustomobject]@{ Path = $readyFile; SHA256 = Get-Sha256 $readyFile }
} finally { Pop-Location }
