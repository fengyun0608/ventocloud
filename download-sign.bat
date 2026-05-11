@echo off
echo ========================================
echo   VentoCloud 签名服务下载器
echo ========================================
echo.
echo 请选择下载方式：
echo.
echo [1] 手动下载 SignManager (推荐)
echo     访问: https://github.com/MrXiaoM/SignManager/releases
echo     下载: SignManager-1.3.3-win-x64.exe
echo     保存到: %~dp0qsign\SignManager.exe
echo.
echo [2] 手动下载 unidbg-fetch-qsign
echo     访问: https://github.com/fuqiuluo/unidbg-fetch-qsign/releases
echo     下载 Windows 版本
echo     解压到: %~dp0qsign
echo.
echo [3] 使用 Docker (需要 Docker Desktop)
echo     运行: docker run -d -p 8080:8080 chenos/uni-qsign:latest
echo.
echo ========================================
echo 下载完成后，请运行 SignManager.exe
echo 或运行 qsign 目录下的启动脚本
echo ========================================
pause