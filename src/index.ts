import { VentoCloudAdapter } from './adapter.js';
import { ApiServer } from './api/server.js';
import { WebUIServer } from './webui/server.js';
import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('🚀 VentoCloud 启动中...');

  const config = loadConfig();
  
  const adapter = new VentoCloudAdapter(config);
  
  const apiServer = new ApiServer(config, adapter);
  await apiServer.start();

  if (config.webui?.enable !== false) {
    const webuiServer = new WebUIServer(config, adapter);
    await webuiServer.start();
  }

  logger.info(`✅ VentoCloud 启动完成!`);
  logger.info(`   API: http://localhost:${config.api?.http?.port || 3000}`);
  if (config.webui?.enable !== false) {
    logger.info(`   WebUI: http://localhost:${config.webui?.port || 8080}`);
  }
  
  if (config.qq?.account) {
    logger.info(`🤖 尝试登录 QQ: ${config.qq.account}`);
    await adapter.login(config.qq.account, {
      password: config.qq.password,
      protocol: config.qq.protocol || 3,
    });
  }
}

main().catch(err => {
  logger.error(err);
  process.exit(1);
});