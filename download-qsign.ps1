# 手动下载签名服务
# 
# 1. 访问: https://github.com/fuqiuluo/unidbg-fetch-qsign/releases
# 2. 下载 Windows 版本 (qsign-windows-x64-xxx.zip)
# 3. 解压到 D:\ventocloud\qsign 目录
# 4. 运行: .\qsign.exe
#
# 或者直接用 curl 下载 (如果 curl 可用):
# curl -L -o qsign.zip "https://github.com/fuqiuluo/unidbg-fetch-qsign/releases/download/v8.9.85/qsign-windows-x64-8.9.85.zip"

Write-Host "请手动下载签名服务:" -ForegroundColor Yellow
Write-Host "1. 访问: https://github.com/fuqiuluo/unidbg-fetch-qsign/releases" -ForegroundColor Cyan
Write-Host "2. 下载 Windows 版本" -ForegroundColor Cyan
Write-Host "3. 解压到 D:\ventocloud\qsign" -ForegroundColor Cyan
Write-Host "4. 运行: .\qsign.exe" -ForegroundColor Cyan
Write-Host ""
Write-Host "或者使用 Docker (如果可用):" -ForegroundColor Yellow
Write-Host "docker run -d -p 8080:8080 chenos/uni-qsign:latest" -ForegroundColor Cyan