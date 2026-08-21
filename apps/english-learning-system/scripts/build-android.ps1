param(
  [string]$JavaHome = $env:JAVA_HOME,
  [string]$AndroidSdkRoot = $env:ANDROID_SDK_ROOT,
  [string]$GradleUserHome = $env:GRADLE_USER_HOME
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $JavaHome) { throw '请通过 JAVA_HOME 或 -JavaHome 指定 JDK 21。' }
if (-not $AndroidSdkRoot) { throw '请通过 ANDROID_SDK_ROOT 或 -AndroidSdkRoot 指定 Android SDK。' }
if (-not $GradleUserHome) { $GradleUserHome = Join-Path $projectRoot '.gradle-cache' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_SDK_ROOT = $AndroidSdkRoot
$env:GRADLE_USER_HOME = $GradleUserHome

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '') }
    finally { $sha.Dispose() }
  } finally { $stream.Dispose() }
}

foreach ($required in @(
  (Join-Path $env:JAVA_HOME 'bin\java.exe'),
  (Join-Path $env:ANDROID_SDK_ROOT 'platforms\android-35\android.jar'),
  (Join-Path $projectRoot 'android\gradlew.bat')
)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Missing Android build dependency: $required"
  }
}

Push-Location $projectRoot
try {
  & npm run android:sync
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed with exit code $LASTEXITCODE" }
  Push-Location (Join-Path $projectRoot 'android')
  try {
    & '.\gradlew.bat' assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }

  $source = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
  $releaseDir = Join-Path $projectRoot 'release-ready'
  $target = Join-Path $releaseDir 'Tutor-Test-0.1.0-Android.apk'
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  [pscustomobject]@{ Path = $target; SHA256 = Get-Sha256 $target }
} finally { Pop-Location }
