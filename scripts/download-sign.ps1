# 下载 SignManager 签名服务管理器

$ErrorActionPreference = "Stop"
$savePath = "$PSScriptRoot\..\qsign"
$exePath = "$savePath\SignManager.exe"

Write-Host "📦 正在下载 SignManager..." -ForegroundColor Cyan

if (!(Test-Path $savePath)) {
    New-Item -ItemType Directory -Path $savePath -Force | Out-Null
}

# 下载 SignManager (使用 PowerShell 的 WebClient)
$url = "https://github.com/MrXiaoM/SignManager/releases/download/v1.3.3/SignManager-1.3.3-win-x64.exe"

try {
    # 使用 Invoke-WebRequest 下载
    Invoke-WebRequest -Uri $url -OutFile $exePath -UseBasicParsing
    Write-Host "✅ 下载完成: $exePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "使用说明:" -ForegroundColor Yellow
    Write-Host "1. 双击运行 SignManager.exe" -ForegroundColor White
    Write-Host "2. 需要先安装 .NET Core 6.0 运行时" -ForegroundColor White
    Write-Host "3. 点击'下载/更新签名服务'下载 8.9.63 版本" -ForegroundColor White
    Write-Host "4. 生成启动脚本后运行" -ForegroundColor White
    Write-Host "5. 确保签名服务在 http://127.0.0.1:8080 运行" -ForegroundColor White
} catch {
    Write-Host "❌ 下载失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "请手动下载: https://github.com/MrXiaoM/SignManager/releases" -ForegroundColor Yellow
}