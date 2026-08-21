$ErrorActionPreference = 'Stop'

$appDirectory = Join-Path $PSScriptRoot 'apps\english-learning-system'
Set-Location -LiteralPath $appDirectory
& npm.cmd run dev -- --host 127.0.0.1 --port 5173

