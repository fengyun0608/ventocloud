$ErrorActionPreference = "Continue"
$proc = Start-Process -FilePath "node" -ArgumentList "--import","tsx","src/index.ts" -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden
Write-Host "VentoCloud 进程已启动, PID: $($proc.Id)"
Start-Sleep 3
Write-Host "请在浏览器访问 http://localhost:8080"