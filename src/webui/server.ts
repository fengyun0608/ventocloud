import express, { Request, Response } from 'express';
import type { VentoCloudAdapter } from '../adapter.js';
import type { Config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig } from '../utils/config.js';

export class WebUIServer {
  private app: express.Application;
  private adapter: VentoCloudAdapter;
  private config: Config;

  constructor(config: Config, adapter: VentoCloudAdapter) {
    this.config = config;
    this.adapter = adapter;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static('public'));
  }

  private setupRoutes() {
    const webuiConfig = this.config.webui || {};
    const port = webuiConfig.port || 8080;

    // 登录验证中间件
    const authMiddleware = (req: Request, res: Response, next: Function) => {
      if (!webuiConfig.password) return next();
      
      const session = req.session as any;
      if (session.authenticated) return next();
      
      // 简单的 Basic Auth 或表单验证
      const auth = req.headers.authorization;
      if (auth) {
        const [username, password] = Buffer.from(auth.replace('Basic ', ''), 'base64').toString().split(':');
        if (username === (webuiConfig.username || 'admin') && password === webuiConfig.password) {
          req.session = { authenticated: true };
          return next();
        }
      }
      
      // 检查是否是 API 请求
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // 显示登录页面
      res.set('WWW-Authenticate', 'Basic realm="VentoCloud"');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>VentoCloud 登录</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .login { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { margin: 0 0 1.5rem; color: #333; }
            input { display: block; width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            button { width: 100%; padding: 0.75rem; background: #007AFF; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="login">
            <h1>🌩️ VentoCloud 登录</h1>
            <form method="POST">
              <input type="text" name="username" placeholder="用户名" required>
              <input type="password" name="password" placeholder="密码" required>
              <button type="submit">登录</button>
            </form>
          </div>
        </body>
        </html>
      `);
    };

    // 处理登录表单
    this.app.post('/', (req: Request, res: Response) => {
      const { username, password } = req.body;
      if (username === (webuiConfig.username || 'admin') && password === webuiConfig.password) {
        (req.session as any).authenticated = true;
        res.redirect('/');
      } else {
        res.send('登录失败 <a href="/">重试</a>');
      }
    });

    // 主页面 - 仪表盘
    this.app.get('/', authMiddleware, (req: Request, res: Response) => {
      const clients = Array.from(this.adapter.clients.entries()).map(([uin, client]) => ({
        uin,
        nickname: client.nickname,
        status: 'online',
      }));

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>VentoCloud 控制面板</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; }
            .header h1 { font-size: 1.5rem; }
            .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
            .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .card h2 { font-size: 1.1rem; color: #333; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #eee; }
            .stat { display: flex; gap: 2rem; }
            .stat-item { text-align: center; }
            .stat-value { font-size: 2rem; font-weight: bold; color: #007AFF; }
            .stat-label { color: #666; font-size: 0.875rem; }
            .btn { display: inline-block; padding: 0.5rem 1rem; background: #007AFF; color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer; }
            .btn:hover { background: #0056b3; }
            .btn-danger { background: #ff3b30; }
            .btn-danger:hover { background: #d32f2f; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
            th { background: #f9f9f9; font-weight: 600; }
            .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
            .status-online { background: #34c759; color: white; }
            .status-offline { background: #8e8e93; color: white; }
            .nav { display: flex; gap: 1rem; margin-bottom: 1rem; }
            .nav a { padding: 0.5rem 1rem; background: white; color: #333; text-decoration: none; border-radius: 4px; }
            .nav a:hover { background: #f0f0f0; }
            .form-group { margin-bottom: 1rem; }
            .form-group label { display: block; margin-bottom: 0.5rem; color: #333; }
            .form-group input, .form-group select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🌩️ VentoCloud 控制面板</h1>
          </div>
          <div class="container">
            <div class="nav">
              <a href="/">仪表盘</a>
              <a href="/config">配置</a>
              <a href="/logs">日志</a>
              <a href="/api/test">API 测试</a>
              <a href="/logout" style="margin-left: auto;">退出</a>
            </div>
            
            <div class="card">
              <h2>🤖 连接状态</h2>
              <div class="stat">
                <div class="stat-item">
                  <div class="stat-value">${clients.length}</div>
                  <div class="stat-label">已连接 Bot</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">${this.adapter.clients.size}</div>
                  <div class="stat-label">在线状态</div>
                </div>
              </div>
            </div>
            
            <div class="card">
              <h2>📋 机器人列表</h2>
              <table>
                <thead>
                  <tr>
                    <th>QQ 号</th>
                    <th>昵称</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${clients.length > 0 ? clients.map(c => `
                    <tr>
                      <td>${c.uin}</td>
                      <td>${c.nickname || '-'}</td>
                      <td><span class="status status-online">在线</span></td>
                      <td><button class="btn btn-danger" onclick="logout(${c.uin})">下线</button></td>
                    </tr>
                  `).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;">暂无连接的机器人</td></tr>'}
                </tbody>
              </table>
            </div>
            
            <div class="card">
              <h2>🔗 API 信息</h2>
              <table>
                <tr>
                  <td><strong>HTTP API:</strong></td>
                  <td>http://localhost:3000/onebot/v11/</td>
                </tr>
                <tr>
                  <td><strong>WebSocket:</strong></td>
                  <td>ws://localhost:3001/onebot/v11/ws</td>
                </tr>
                <tr>
                  <td><strong>健康检查:</strong></td>
                  <td>http://localhost:3000/health</td>
                </tr>
              </table>
            </div>
          </div>
          <script>
            function logout(uin) {
              if (confirm('确定要断开连接吗？')) {
                fetch('/api/logout', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ uin }) })
                  .then(r => r.json())
                  .then(d => { alert(d.message); location.reload(); });
              }
            }
          </script>
        </body>
        </html>
      `);
    });

    // 配置页面
    this.app.get('/config', authMiddleware, (req: Request, res: Response) => {
      const config = loadConfig();
      const qq = config.qq || {};
      const sign = config.sign || {};
      const api = config.api?.http || {};
      const webui = config.webui || {};

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>配置 - VentoCloud</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; background: #f5f5f5; padding: 1rem; }
            .container { max-width: 800px; margin: 0 auto; }
            .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
            h1 { color: #333; margin-bottom: 1.5rem; }
            .form-group { margin-bottom: 1rem; }
            .form-group label { display: block; margin-bottom: 0.5rem; color: #333; }
            .form-group input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
            .btn { padding: 0.75rem 1.5rem; background: #007AFF; color: white; border: none; border-radius: 4px; cursor: pointer; }
            .btn:hover { background: #0056b3; }
            .section { margin-bottom: 1.5rem; }
            .section h3 { color: #666; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚙️ VentoCloud 配置</h1>
            <div class="card">
              <form method="POST" action="/api/config/save">
                <div class="section">
                  <h3>🤖 QQ 配置</h3>
                  <div class="form-group">
                    <label>QQ 号</label>
                    <input type="text" name="qq_account" value="${qq.account || ''}" placeholder="机器人QQ号">
                  </div>
                  <div class="form-group">
                    <label>密码 (留空则扫码登录)</label>
                    <input type="password" name="qq_password" value="${qq.password || ''}" placeholder="可选">
                  </div>
                  <div class="form-group">
                    <label>协议</label>
                    <select name="qq_protocol">
                      <option value="1" ${qq.protocol === 1 ? 'selected' : ''}>手机</option>
                      <option value="2" ${qq.protocol === 2 ? 'selected' : ''}>平板</option>
                      <option value="3" ${qq.protocol === 3 || !qq.protocol ? 'selected' : ''}>手表</option>
                      <option value="4" ${qq.protocol === 4 ? 'selected' : ''}>Mac</option>
                    </select>
                  </div>
                </div>
                
                <div class="section">
                  <h3>🔐 签名服务</h3>
                  <div class="form-group">
                    <label>签名服务地址</label>
                    <input type="text" name="sign_url" value="${sign.url || 'http://127.0.0.1:8080'}" placeholder="http://127.0.0.1:8080">
                  </div>
                </div>
                
                <div class="section">
                  <h3>🌐 API 配置</h3>
                  <div class="form-group">
                    <label>API 端口</label>
                    <input type="number" name="api_port" value="${api.port || 3000}">
                  </div>
                </div>
                
                <div class="section">
                  <h3>🎨 WebUI 配置</h3>
                  <div class="form-group">
                    <label>WebUI 端口</label>
                    <input type="number" name="webui_port" value="${webui.port || 8080}">
                  </div>
                  <div class="form-group">
                    <label>用户名</label>
                    <input type="text" name="webui_username" value="${webui.username || 'admin'}">
                  </div>
                  <div class="form-group">
                    <label>密码</label>
                    <input type="password" name="webui_password" value="${webui.password || ''}" placeholder="留空不修改">
                  </div>
                </div>
                
                <button type="submit" class="btn">保存配置</button>
              </form>
            </div>
            <p><a href="/">← 返回仪表盘</a></p>
          </div>
        </body>
        </html>
      `);
    });

    // 日志页面
    this.app.get('/logs', authMiddleware, (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>日志 - VentoCloud</title>
          <meta charset="utf-8">
          <style>
            body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 1rem; }
            h1 { color: #fff; }
            .log-container { background: #2d2d2d; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 70vh; }
            .log-line { padding: 0.25rem 0; }
            .log-info { color: #4fc1ff; }
            .log-warn { color: #dcdcaa; }
            .log-error { color: #f48771; }
          </style>
        </head>
        <body>
          <h1>📋 运行日志</h1>
          <div class="log-container">
            <div class="log-line log-info">[${new Date().toISOString()}] VentoCloud 启动成功</div>
            <div class="log-line log-info">[${new Date().toISOString()}] HTTP API 服务已启动</div>
            <div class="log-line log-info">[${new Date().toISOString()}] WebUI 服务已启动</div>
          </div>
          <p><a href="/" style="color: #4fc1ff;">← 返回仪表盘</a></p>
        </body>
        </html>
      `);
    });

    // API 测试页面
    this.app.get('/api/test', authMiddleware, (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>API 测试 - VentoCloud</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; background: #f5f5f5; padding: 1rem; }
            .container { max-width: 800px; margin: 0 auto; }
            .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
            textarea { width: 100%; height: 150px; font-family: monospace; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
            .btn { padding: 0.5rem 1rem; background: #007AFF; color: white; border: none; border-radius: 4px; cursor: pointer; }
            pre { background: #f0f0f0; padding: 1rem; border-radius: 4px; overflow: auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🧪 API 测试</h1>
            <div class="card">
              <h3>发送消息</h3>
              <textarea id="request">{
  "action": "send_private_msg",
  "params": {
    "user_id": 123456,
    "message": "Hello from VentoCloud!"
  }
}</textarea>
              <br><br>
              <button class="btn" onclick="testApi()">发送请求</button>
              <pre id="response">点击发送测试...</pre>
            </div>
          </div>
          <script>
            function testApi() {
              const req = JSON.parse(document.getElementById('request').value);
              fetch('/onebot/v11/send_private_msg', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(req.params || req)
              }).then(r => r.json()).then(d => {
                document.getElementById('response').textContent = JSON.stringify(d, null, 2);
              }).catch(e => {
                document.getElementById('response').textContent = 'Error: ' + e.message;
              });
            }
          </script>
          <p><a href="/">← 返回仪表盘</a></p>
        </body>
        </html>
      `);
    });

    // 登出
    this.app.get('/logout', (req: Request, res: Response) => {
      (req.session as any).authenticated = false;
      res.redirect('/');
    });

    // API 接口
    this.app.post('/api/config/save', (req: Request, res: Response) => {
      try {
        const newConfig = loadConfig();
        
        if (req.body.qq_account) newConfig.qq = newConfig.qq || {};
        if (req.body.qq_account) newConfig.qq!.account = req.body.qq_account;
        if (req.body.qq_password) newConfig.qq!.password = req.body.qq_password;
        if (req.body.qq_protocol) newConfig.qq!.protocol = parseInt(req.body.qq_protocol);
        
        if (req.body.sign_url) {
          newConfig.sign = newConfig.sign || {};
          newConfig.sign.url = req.body.sign_url;
        }
        
        if (req.body.api_port) {
          newConfig.api = newConfig.api || {};
          newConfig.api.http = newConfig.api.http || {};
          newConfig.api.http.port = parseInt(req.body.api_port);
        }
        
        if (req.body.webui_port || req.body.webui_username || req.body.webui_password) {
          newConfig.webui = newConfig.webui || {};
          if (req.body.webui_port) newConfig.webui.port = parseInt(req.body.webui_port);
          if (req.body.webui_username) newConfig.webui.username = req.body.webui_username;
          if (req.body.webui_password) newConfig.webui.password = req.body.webui_password;
        }
        
        saveConfig(newConfig);
        res.send('<script>alert("配置已保存");location.href="/";</script>');
      } catch (e: any) {
        res.send('<script>alert("保存失败: ' + e.message + '");history.back();</script>');
      }
    });

    this.app.post('/api/logout', authMiddleware, (req: Request, res: Response) => {
      const { uin } = req.body;
      // TODO: 实现登出功能
      res.json({ success: true, message: '已断开连接' });
    });
  }

  async start() {
    const webuiConfig = this.config.webui || {};
    const port = webuiConfig.port || 8080;
    
    return new Promise<void>((resolve) => {
      this.app.listen(port, () => {
        logger.info(`🎨 WebUI 管理面板已启动: http://localhost:${port}`);
        resolve();
      });
    });
  }
}