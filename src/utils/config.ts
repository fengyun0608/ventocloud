import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface Config {
  qq?: {
    account?: string;
    password?: string;
    protocol?: number;
  };
  sign?: {
    url?: string;
    api_key?: string;
  };
  api?: {
    http?: {
      enable?: boolean;
      host?: string;
      port?: number;
      secret?: string;
    };
    ws?: {
      enable?: boolean;
      host?: string;
      port?: number;
    };
  };
  webui?: {
    enable?: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  log?: {
    level?: string;
  };
}

const defaultConfig: Config = {
  qq: {
    account: '',
    password: '',
    protocol: 3,
  },
  sign: {
    url: 'http://127.0.0.1:8080',
  },
  api: {
    http: {
      enable: true,
      host: '0.0.0.0',
      port: 3000,
      secret: '',
    },
    ws: {
      enable: true,
      host: '0.0.0.0',
      port: 3001,
    },
  },
  webui: {
    enable: true,
    host: '0.0.0.0',
    port: 8080,
    username: 'admin',
    password: 'ventocloud',
  },
  log: {
    level: 'info',
  },
};

export function loadConfig(): Config {
  const configPaths = [
    './config.yaml',
    './config.yml',
    './config.json',
  ];

  for (const configPath of configPaths) {
    const fullPath = path.resolve(process.cwd(), configPath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const loaded = yaml.load(content) as Config;
        return { ...defaultConfig, ...loaded };
      } catch (e) {
        console.error(`Failed to load config from ${configPath}:`, e);
      }
    }
  }

  return defaultConfig;
}

export function saveConfig(config: Config): void {
  const configPath = path.resolve(process.cwd(), './config.yaml');
  fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');
}