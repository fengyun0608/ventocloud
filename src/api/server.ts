import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { VentoCloudAdapter } from '../adapter.js';
import type { Config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

interface WSClient {
  ws: WebSocket;
  self_id: number;
}

export class ApiServer {
  private app: express.Application;
  private wss: WebSocketServer | null = null;
  private wsClients: WSClient[] = [];
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
  }

  private setupRoutes() {
    const httpConfig = this.config.api?.http || {};
    const port = httpConfig.port || 3000;
    const secret = httpConfig.secret || '';

    // 跨域支持
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // 签名验证
    this.app.use((req, res, next) => {
      if (secret && req.headers['x-self-id']) {
        const reqSecret = req.headers['authorization'] || req.query.access_token;
        if (reqSecret !== secret) {
          return res.status(403).json({ status: 'failed', retcode: 1403, message: '签名验证失败' });
        }
      }
      next();
    });

    // OneBot V11 API
    this.app.post('/onebot/v11/send_private_msg', this.sendPrivateMsg.bind(this));
    this.app.post('/onebot/v11/send_group_msg', this.sendGroupMsg.bind(this));
    this.app.get('/onebot/v11/get_friend_list', this.getFriendList.bind(this));
    this.app.get('/onebot/v11/get_group_list', this.getGroupList.bind(this));
    this.app.get('/onebot/v11/get_group_member_list', this.getGroupMemberList.bind(this));
    this.app.post('/onebot/v11/set_group_ban', this.setGroupBan.bind(this));
    this.app.post('/onebot/v11/set_group_kick', this.setGroupKick.bind(this));
    this.app.post('/onebot/v11/set_group_admin', this.setGroupAdmin.bind(this));
    this.app.post('/onebot/v11/set_group_card', this.setGroupCard.bind(this));
    this.app.post('/onebot/v11/set_group_name', this.setGroupName.bind(this));
    this.app.post('/onebot/v11/recall', this.recall.bind(this));
    this.app.get('/onebot/v11/get_msg', this.getMsg.bind(this));
    this.app.get('/onebot/v11/get_friend_info', this.getFriendInfo.bind(this));
    this.app.get('/onebot/v11/get_group_info', this.getGroupInfo.bind(this));
    this.app.get('/onebot/v11/get_group_member_info', this.getGroupMemberInfo.bind(this));
    this.app.post('/onebot/v11/send_group_sign', this.sendGroupSign.bind(this));
    this.app.get('/onebot/v11/get_cookies', this.getCookies.bind(this));
    this.app.post('/onebot/v11/set_friend_add_request', this.setFriendAddRequest.bind(this));
    this.app.post('/onebot/v11/set_group_add_request', this.setGroupAddRequest.bind(this));

    // WebSocket
    this.app.get('/onebot/v11/ws', (req: Request, res: Response) => {
      res.send('WebSocket endpoint, please use WS connection');
    });

    // 健康检查
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', clients: this.adapter.clients.size });
    });

    // WebSocket 服务器
    const wsConfig = this.config.api?.ws || {};
    if (wsConfig.enable !== false) {
      this.wss = new WebSocketServer({
        port: wsConfig.port || 3001,
        path: '/onebot/v11/ws',
      });

      this.wss.on('connection', (ws, req) => {
        this.handleWSConnection(ws, req);
      });

      logger.info(`📡 WebSocket 服务已启动: ws://${wsConfig.host || '0.0.0.0'}:${wsConfig.port || 3001}/onebot/v11/ws`);
    }
  }

  private handleWSConnection(ws: WebSocket, req: any) {
    logger.info('🔌 WebSocket 客户端连接');

    // 解析 URL 参数获取 self_id
    const url = new URL(req.url, 'http://localhost');
    const selfId = Number(url.searchParams.get('self_id')) || Number(url.searchParams.get('self_id'));

    const client: WSClient = { ws, self_id: selfId || 0 };
    this.wsClients.push(client);

    // 监听适配器事件并推送
    const eventHandler = (event: string, data: any) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          post_type: data.post_type,
          message_type: data.message_type,
          notice_type: data.notice_type,
          request_type: data.request_type,
          ...data,
        }));
      }
    };

    this.adapter.on('message', eventHandler);
    this.adapter.on('notice', eventHandler);
    this.adapter.on('request', eventHandler);

    ws.on('close', () => {
      this.wsClients = this.wsClients.filter(c => c !== client);
      this.adapter.off('message', eventHandler);
      this.adapter.off('notice', eventHandler);
      this.adapter.off('request', eventHandler);
      logger.info('🔌 WebSocket 客户端断开');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleWSMessage(client, msg);
      } catch (e) {
        logger.error('WebSocket 消息解析失败:', e);
      }
    });
  }

  private handleWSMessage(client: WSClient, msg: any) {
    const { action, params, echo } = msg;
    this.handleApiAction(action, params)
      .then(result => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            status: 'success',
            retcode: 0,
            data: result,
            echo,
          }));
        }
      })
      .catch(err => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            status: 'failed',
            retcode: -1,
            message: err.message,
            echo,
          }));
        }
      });
  }

  private async handleApiAction(action: string, params: any): Promise<any> {
    const self_id = params.self_id || Array.from(this.adapter.clients.keys())[0] || 0;
    
    switch (action) {
      case 'send_private_msg':
        return await this.adapter.sendFriendMsg(self_id, params.user_id, params.message);
      case 'send_group_msg':
        return await this.adapter.sendGroupMsg(self_id, params.group_id, params.message);
      case 'get_friend_list':
        return await this.adapter.getFriendList(self_id);
      case 'get_group_list':
        return await this.adapter.getGroupList(self_id);
      case 'get_group_member_list':
        return await this.adapter.getGroupMemberList(self_id, params.group_id);
      case 'set_group_ban':
        return await this.adapter.setGroupBan(self_id, params.group_id, params.user_id, params.duration);
      case 'set_group_kick':
        return await this.adapter.setGroupKick(self_id, params.group_id, params.user_id);
      case 'set_group_admin':
        return await this.adapter.setGroupAdmin(self_id, params.group_id, params.user_id, params.enable);
      case 'set_group_card':
        return await this.adapter.setGroupCard(self_id, params.group_id, params.user_id, params.card);
      case 'set_group_name':
        return await this.adapter.setGroupName(self_id, params.group_id, params.group_name);
      case 'recall':
        return await this.adapter.recallMsg(self_id, params.message_id);
      case 'get_msg':
        return await this.adapter.getMsg(self_id, params.message_id);
      case 'get_friend_info':
        return await this.adapter.getFriendInfo(self_id, params.user_id);
      case 'get_group_info':
        return await this.adapter.getGroupInfo(self_id, params.group_id);
      case 'get_group_member_info':
        return await this.adapter.getGroupMemberInfo(self_id, params.group_id, params.user_id);
      case 'send_group_sign':
        return await this.adapter.sendGroupSign(self_id, params.group_id);
      case 'get_cookies':
        return await this.adapter.getCookies(self_id);
      case 'set_friend_add_request':
        return await this.adapter.setFriendAddRequest(self_id, params.flag, params.approve, params.remark);
      case 'set_group_add_request':
        return await this.adapter.setGroupAddRequest(self_id, params.flag, params.sub_type, params.approve, params.reason);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // API Handlers
  private async sendPrivateMsg(req: Request, res: Response) {
    try {
      const { user_id, message, self_id } = req.body;
      const qq = self_id || Number(req.query.self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.sendFriendMsg(qq, user_id, message);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async sendGroupMsg(req: Request, res: Response) {
    try {
      const { group_id, message, self_id } = req.body;
      const qq = self_id || Number(req.query.self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.sendGroupMsg(qq, group_id, message);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getFriendList(req: Request, res: Response) {
    try {
      const self_id = Number(req.query.self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getFriendList(self_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getGroupList(req: Request, res: Response) {
    try {
      const self_id = Number(req.query.self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getGroupList(self_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getGroupMemberList(req: Request, res: Response) {
    try {
      const { group_id, self_id } = req.query;
      const qq = Number(self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getGroupMemberList(qq, Number(group_id));
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupBan(req: Request, res: Response) {
    try {
      const { group_id, user_id, duration, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupBan(qq, group_id, user_id, duration);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupKick(req: Request, res: Response) {
    try {
      const { group_id, user_id, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupKick(qq, group_id, user_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupAdmin(req: Request, res: Response) {
    try {
      const { group_id, user_id, enable, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupAdmin(qq, group_id, user_id, enable);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupCard(req: Request, res: Response) {
    try {
      const { group_id, user_id, card, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupCard(qq, group_id, user_id, card);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupName(req: Request, res: Response) {
    try {
      const { group_id, group_name, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupName(qq, group_id, group_name);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async recall(req: Request, res: Response) {
    try {
      const { message_id, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.recallMsg(qq, message_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getMsg(req: Request, res: Response) {
    try {
      const { message_id, self_id } = req.query;
      const qq = Number(self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getMsg(qq, Number(message_id));
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getFriendInfo(req: Request, res: Response) {
    try {
      const { user_id, self_id } = req.query;
      const qq = Number(self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getFriendInfo(qq, Number(user_id));
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getGroupInfo(req: Request, res: Response) {
    try {
      const { group_id, self_id } = req.query;
      const qq = Number(self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getGroupInfo(qq, Number(group_id));
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getGroupMemberInfo(req: Request, res: Response) {
    try {
      const { group_id, user_id, self_id } = req.query;
      const qq = Number(self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getGroupMemberInfo(qq, Number(group_id), Number(user_id));
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async sendGroupSign(req: Request, res: Response) {
    try {
      const { group_id, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.sendGroupSign(qq, group_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async getCookies(req: Request, res: Response) {
    try {
      const self_id = Number(req.query.self_id) || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.getCookies(self_id);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setFriendAddRequest(req: Request, res: Response) {
    try {
      const { flag, approve, remark, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setFriendAddRequest(qq, flag, approve, remark);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  private async setGroupAddRequest(req: Request, res: Response) {
    try {
      const { flag, sub_type, approve, reason, self_id } = req.body;
      const qq = self_id || Array.from(this.adapter.clients.keys())[0];
      const result = await this.adapter.setGroupAddRequest(qq, flag, sub_type, approve, reason);
      res.json({ status: 'success', retcode: 0, data: result });
    } catch (e: any) {
      res.json({ status: 'failed', retcode: -1, message: e.message });
    }
  }

  async start() {
    const httpConfig = this.config.api?.http || {};
    const port = httpConfig.port || 3000;
    
    return new Promise<void>((resolve) => {
      this.app.listen(port, () => {
        logger.info(`🌐 HTTP API 服务已启动: http://${httpConfig.host || '0.0.0.0'}:${port}`);
        resolve();
      });
    });
  }
}