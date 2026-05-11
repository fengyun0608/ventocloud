#!/bin/bash
# VentoCloud 签名服务部署脚本

echo "🌩️ 部署 VentoCloud 签名服务..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 拉取并运行签名服务
echo "📦 拉取签名服务镜像..."
docker pull chenos/uni-qsign:latest

echo "🚀 启动签名服务..."
docker run -d \
    --name ventocloud-qsign \
    -p 8080:8080 \
    -v ./qsign-data:/app/data \
    -e QUERY_KEY= \
    --restart unless-stopped \
    chenos/uni-qsign:latest

echo "✅ 签名服务部署完成!"
echo "   签名服务地址: http://localhost:8080"
echo ""
echo "现在可以启动 VentoCloud: npm run dev"