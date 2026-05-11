# VentoCloud 签名服务部署指南

## 快速开始

### 步骤1：安装 .NET Core 运行时
下载并安装：https://dotnet.microsoft.com/zh-cn/download/dotnet/6.0

### 步骤2：下载 SignManager
访问以下链接下载 SignManager：
- https://github.com/MrXiaoM/SignManager/releases

下载文件：`SignManager-1.3.3-win-x64.exe`（或最新版本）

保存到：`D:\ventocloud\qsign\SignManager.exe`

### 步骤3：运行 SignManager

1. 双击运行 SignManager.exe
2. 点击【下载/更新签名服务】
3. 选择版本 `8.9.63`（推荐）
4. 点击【下载】，等待完成
5. 点击【生成该版本启动脚本】
6. 找到生成的 `start_unidbg-fetch-qsign.cmd` 并运行

### 步骤4：验证签名服务

浏览器打开：http://127.0.0.1:8080

如果显示类似 `IAA 云天明 章北海` 的文字，则签名服务运行正常。

### 步骤5：启动 VentoCloud

```bash
cd D:\ventocloud
npm run dev
```

---

## 故障排除

### 问题：SignManager 无法下载
- 检查网络代理
- 尝试关闭代理后重试

### 问题：签名服务启动失败
- 确保 Java 运行时已安装
- 检查端口 8080 是否被占用

### 问题：QQ 登录失败
- 检查签名服务是否正常运行
- 尝试不同的 QQ 版本（8.9.63 较稳定）