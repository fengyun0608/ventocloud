import { createClient, type Client } from 'icqq';
import { EventEmitter } from 'events';
import { logger } from './utils/logger.js';
import type { Config } from './utils/config.js';

export class VentoCloudAdapter extends EventEmitter {
  id = 'ventocloud';
  name = 'VentoCloud';
  path = 'ventocloud';
  
  clients = new Map<number, Client>();
  config: Config;
  
  constructor(config: Config) {
    super();
    this.config = config;
  }

  async login(uin: string | number, options: {
    password?: string;
    protocol?: number;
  } = {}) {
    const qq = Number(uin);
    
    const client = createClient({
      platform: options.protocol || 3,
      data_dir: `./data/${qq}`,
      sign_api_addr: this.config.sign?.url || 'http://127.0.0.1:8080',
      ignore_self: true,
      resend: true,
    });

    this.bindEvents(client, qq);
    this.clients.set(qq, client);

    if (options.password) {
      client.login(options.password);
    } else {
      client.on('system.login.qrcode', () => {
        logger.info('📱 请扫码登录...');
      });
      client.on('system.login.device', () => {
        logger.info('🔐 请在设备上确认登录...');
      });
      client.login();
    }

    return client;
  }

  private bindEvents(client: Client, uin: number) {
    client.on('message', (e) => this.handleMessage(uin, e));
    client.on('message.private', (e) => this.handlePrivateMessage(uin, e));
    client.on('message.group', (e) => this.handleGroupMessage(uin, e));
    client.on('notice.group_increase', (e) => this.handleGroupIncrease(uin, e));
    client.on('notice.group_decrease', (e) => this.handleGroupDecrease(uin, e));
    client.on('notice.friend_add', (e) => this.handleFriendAdd(uin, e));
    client.on('request.friend.add', (e) => this.handleFriendRequest(uin, e));
    client.on('request.group.add', (e) => this.handleGroupRequest(uin, e));
    client.on('system.online', () => logger.info(`✅ QQ ${uin} 上线成功`));
    client.on('system.offline', () => logger.warn(`⚠️ QQ ${uin} 离线`));
  }

  private handleMessage(uin: number, e: any) {
    this.handlePrivateMessage(uin, e);
    this.handleGroupMessage(uin, e);
  }

  private handlePrivateMessage(uin: number, e: any) {
    const data = {
      self_id: uin,
      user_id: e.sender.user_id,
      message_id: e.message_id,
      message: this.parseMessage(e.message),
      raw_message: e.raw_message,
      message_type: 'private',
      sub_type: e.sub_type || 'friend',
      post_type: 'message',
      time: e.time,
      sender: {
        user_id: e.sender.user_id,
        nickname: e.sender.nickname,
      },
    };
    this.emit('message.private', data);
    this.emit('message', data);
  }

  private handleGroupMessage(uin: number, e: any) {
    const data = {
      self_id: uin,
      group_id: e.group_id,
      user_id: e.sender.user_id,
      message_id: e.message_id,
      message: this.parseMessage(e.message),
      raw_message: e.raw_message,
      message_type: 'group',
      sub_type: 'normal',
      post_type: 'message',
      time: e.time,
      sender: {
        user_id: e.sender.user_id,
        nickname: e.sender.nickname,
        card: e.sender.card,
        role: e.sender.role,
        title: e.sender.title,
      },
    };
    this.emit('message.group', data);
    this.emit('message', data);
  }

  private handleGroupIncrease(uin: number, e: any) {
    const data = {
      self_id: uin,
      group_id: e.group_id,
      user_id: e.user_id,
      post_type: 'notice',
      notice_type: 'group',
      sub_type: 'increase',
      time: e.time,
      operator_id: e.operator_id,
    };
    this.emit('notice.group_increase', data);
  }

  private handleGroupDecrease(uin: number, e: any) {
    const data = {
      self_id: uin,
      group_id: e.group_id,
      user_id: e.user_id,
      post_type: 'notice',
      notice_type: 'group',
      sub_type: 'decrease',
      time: e.time,
      operator_id: e.operator_id,
      dismiss: e.dismissed,
    };
    this.emit('notice.group_decrease', data);
  }

  private handleFriendAdd(uin: number, e: any) {
    const data = {
      self_id: uin,
      user_id: e.user_id,
      post_type: 'notice',
      notice_type: 'friend',
      sub_type: 'add',
      time: e.time,
    };
    this.emit('notice.friend_add', data);
  }

  private handleFriendRequest(uin: number, e: any) {
    const data = {
      self_id: uin,
      user_id: e.user_id,
      comment: e.comment,
      flag: e.flag,
      post_type: 'request',
      request_type: 'friend',
      time: e.time,
    };
    this.emit('request.friend.add', data);
  }

  private handleGroupRequest(uin: number, e: any) {
    const data = {
      self_id: uin,
      group_id: e.group_id,
      user_id: e.user_id,
      comment: e.comment,
      flag: e.flag,
      post_type: 'request',
      request_type: 'group',
      sub_type: e.sub_type,
      time: e.time,
    };
    this.emit('request.group.add', data);
  }

  private parseMessage(message: any): any[] {
    const result = [];
    if (!message) return result;
    
    for (const seg of message) {
      if (seg.type === 'text') {
        result.push({ type: 'text', text: seg.text });
      } else if (seg.type === 'image') {
        result.push({ type: 'image', file: seg.file, url: seg.url });
      } else if (seg.type === 'at') {
        result.push({ type: 'at', qq: seg.qq });
      } else if (seg.type === 'face') {
        result.push({ type: 'face', id: seg.id });
      } else if (seg.type === 'record') {
        result.push({ type: 'record', file: seg.file });
      } else if (seg.type === 'reply') {
        result.push({ type: 'reply', id: seg.id });
      } else if (seg.type === 'video') {
        result.push({ type: 'video', file: seg.file });
      }
    }
    return result;
  }

  async sendFriendMsg(uin: number, userId: number, message: any) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    const msg = await this.buildMessage(message);
    return await client.sendPrivateMsg(userId, msg);
  }

  async sendGroupMsg(uin: number, groupId: number, message: any) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    const msg = await this.buildMessage(message);
    return await client.sendGroupMsg(groupId, msg);
  }

  private async buildMessage(message: any): Promise<any[]> {
    if (typeof message === 'string') {
      return [message];
    }
    if (!Array.isArray(message)) {
      return [String(message)];
    }
    
    const result = [];
    for (const seg of message) {
      if (typeof seg === 'string') {
        result.push(seg);
      } else if (seg.type === 'text') {
        result.push(seg.text);
      } else if (seg.type === 'image') {
        result.push({ type: 'image', file: seg.file || seg.url });
      } else if (seg.type === 'at') {
        result.push({ type: 'at', qq: seg.qq });
      } else if (seg.type === 'face') {
        result.push({ type: 'face', id: seg.id });
      }
    }
    return result;
  }

  async getFriendList(uin: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getFriendList();
  }

  async getGroupList(uin: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getGroupList();
  }

  async getGroupMemberList(uin: number, groupId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getGroupMemberList(groupId);
  }

  async setGroupBan(uin: number, groupId: number, userId: number, duration: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setGroupBan(groupId, userId, duration);
  }

  async setGroupKick(uin: number, groupId: number, userId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.kickGroupMember(groupId, userId);
  }

  async setGroupAdmin(uin: number, groupId: number, userId: number, enable: boolean) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setGroupAdmin(groupId, userId, enable);
  }

  async setGroupCard(uin: number, groupId: number, userId: number, card: string) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setGroupCard(groupId, userId, card);
  }

  async setGroupName(uin: number, groupId: number, name: string) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setGroupName(groupId, name);
  }

  async recallMsg(uin: number, messageId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.recallMsg(messageId);
  }

  async getMsg(uin: number, messageId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getMsg(messageId);
  }

  async getFriendInfo(uin: number, userId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getFriendInfo(userId);
  }

  async getGroupInfo(uin: number, groupId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getGroupInfo(groupId);
  }

  async getGroupMemberInfo(uin: number, groupId: number, userId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getGroupMemberInfo(groupId, userId);
  }

  async sendGroupSign(uin: number, groupId: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.sendGroupSign(groupId);
  }

  async getCookies(uin: number) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.getCookies();
  }

  async setFriendAddRequest(uin: number, flag: string, approve: boolean, remark?: string) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setFriendAddRequest(flag, approve, remark);
  }

  async setGroupAddRequest(uin: number, flag: string, subType: string, approve: boolean, reason?: string) {
    const client = this.clients.get(uin);
    if (!client) throw new Error('Client not found');
    return await client.setGroupAddRequest(flag, subType, approve, reason);
  }
}