# 🌩️ VentoCloud

> 新一代 OneBot 11 适配器 - 超越 NapCat

## ✨ 特性

- 🚀 **极简部署** - 一行命令启动，无需额外软件
- 🎯 **纯 Node.js** - 基于 icqq，无 QQ 客户端依赖
- 🌐 **完整 API** - OneBot v11 标准 + 扩展接口
- 🎨 **WebUI 管理** - 仪表盘/配置/日志/测试
- 📡 **双协议支持** - HTTP + WebSocket
- 🐳 **Docker 支持** - 一键容器化部署

## 🚀 快速开始

### 方式一：直接运行

```bash
# 1. 克隆项目
git clone https://github.com/fengyun0608/ventocloud.git
cd ventocloud

# 2. 安装依赖
npm install

# 3. 启动（需要先部署签名服务）
node src/index.ts
```

### 方式二：Docker 部署

```bash
docker-compose up -d
```

## ⚙️ 配置

编辑 `config.yaml`:

```yaml
qq:
  account: "123456789"   # 机器人QQ号
  password: ""            # 密码，留空扫码登录
  protocol: 3             # 协议：1=手机 2=平板 3=手表 4=Mac

sign:
  url: "http://127.0.0.1:8080"  # 签名服务地址

api:
  http:
    port: 3000
  ws:
    port: 3001

webui:
  port: 8080
  username: "admin"
  password: "ventocloud"
```

## 📡 API 使用

### 发送私聊消息
```bash
curl -X POST http://localhost:3000/onebot/v11/send_private_msg \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123456, "message": "你好"}'
```

### 发送群消息
```bash
curl -X POST http://localhost:3000/onebot/v11/send_group_msg \
  -H "Content-Type: application/json" \
  -d '{"group_id": 987654, "message": "大家好"}'
```

### 获取好友列表
```bash
curl http://localhost:3000/onebot/v11/get_friend_list
```

### WebSocket 连接
```
ws://localhost:3001/onebot/v11/ws
```

## 🎨 WebUI

访问 http://localhost:8080

- 仪表盘：查看连接状态和机器人信息
- 配置：在线编辑配置文件
- 日志：查看运行日志
- API 测试：调试接口

## 📋 OneBot API 列表

| 接口 | 功能 |
|------|------|
| send_private_msg | 发送私聊消息 |
| send_group_msg | 发送群消息 |
| get_friend_list | 好友列表 |
| get_group_list | 群列表 |
| get_group_member_list | 群成员列表 |
| set_group_ban | 禁言 |
| set_group_kick | 踢人 |
| set_group_admin | 设置管理员 |
| set_group_card | 设置名片 |
| set_group_name | 设置群名 |
| recall | 撤回消息 |
| ... | [更多接口](https://github.com/fengyun0608/ventocloud) |

## 🔐 签名服务

需要部署 `unidbg-fetch-qsign` 签名服务：

```bash
# Docker 部署
docker run -d -p 8080:8080 -v ./data:/app/data chenos/uni-qsign:latest
```

## 📝 待办

- [x] 基础消息收发
- [x] OneBot v11 API
- [x] WebUI 管理面板
- [ ] 完整群管理功能
- [ ] 文件/语音传输
- [ ] 监控指标

## 📄 License

MIT License

---

⭐ Star 支持我们！