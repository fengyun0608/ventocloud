# VentoCloud 签名服务下载脚本
# 下载并运行 unidbg-fetch-qsign

$ErrorActionPreference = "Stop"

$version = "8.9.85"  # QQ 版本
$savePath = "$PSScriptRoot\..\qsign"

Write-Host "📦 正在下载 unidbg-fetch-qsign..." -ForegroundColor Cyan

# 创建目录
if (!(Test-Path $savePath)) {
    New-Item -ItemType Directory -Path $savePath -Force | Out-Null
}

# 下载 (使用 GitHub release 链接)
$url = "https://github.com/fuqiuluo/unidbg-fetch-qsign/releases/download/v${version}/qsign-windows-x64-${version}.zip"
$zipPath = "$savePath\qsign.zip"

try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    Write-Host "✅ 下载完成" -ForegroundColor Green
    
    # 解压
    Write-Host "📂 正在解压..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath $savePath -Force
    
    # 清理
    Remove-Item $zipPath -Force
    
    Write-Host "✅ 签名服务已解压到: $savePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "启动签名服务:" -ForegroundColor Yellow
    Write-Host "  cd $savePath"
    Write-Host "  .\qsign.exe"
    
} catch {
    Write-Host "❌ 下载失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "请手动下载: https://github.com/fuqiuluo/unidbg-fetch-qsign/releases" -ForegroundColor Yellow
}