/**
 * Web UI server
 */
import express from 'express';
import cors from 'cors';
import { AgentLoop } from '../agent/loop';
import { VolcEngineProvider, OpenAIProvider } from '../providers';
import { messageBus } from '../bus/queue';
import { getSessionManager } from '../session/manager';
import { logger } from '../config/logger';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';

const app = express();
const PORT = process.env.NANOBOT_PORT || 8765;
const DEFAULT_WORKSPACE = join(process.env.HOME || '/tmp', '.nanobot');
const CONFIG_PATH = join(DEFAULT_WORKSPACE, 'config.yaml');

let agent: AgentLoop | null = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../../dist/web')));

interface Config {
  model: {
    provider: string;
    api_key: string;
    model: string;
    base_url: string;
  };
  restrict_to_workspace: boolean;
  max_iterations: number;
  workspace: string;
}

// Load config
function loadConfig(): Config | null {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return null;
    }
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return yaml.load(content) as Config;
  } catch (error) {
    logger.error('Failed to load config:', error);
    return null;
  }
}

// Save config
function saveConfig(config: Config): void {
  try {
    if (!existsSync(DEFAULT_WORKSPACE)) {
      mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
    }
    const content = yaml.dump(config);
    writeFileSync(CONFIG_PATH, content, 'utf-8');
    logger.info('Config saved to', CONFIG_PATH);
  } catch (error) {
    logger.error('Failed to save config:', error);
    throw error;
  }
}

// Initialize agent
function initAgent(config: Config): AgentLoop {
  let provider;
  switch (config.model.provider.toLowerCase()) {
    case 'volcengine':
    case 'doubao':
      provider = new VolcEngineProvider(config.model.api_key, config.model.base_url);
      break;
    case 'openai':
      provider = new OpenAIProvider(config.model.api_key, config.model.base_url);
      break;
    default:
      throw new Error(`Unsupported provider: ${config.model.provider}`);
  }

  const sessionManager = getSessionManager(config.workspace || DEFAULT_WORKSPACE);
  
  agent = new AgentLoop({
    bus: messageBus,
    provider,
    workspace: config.workspace || DEFAULT_WORKSPACE,
    model: config.model.model,
    session_manager: sessionManager,
    max_iterations: config.max_iterations || 40,
    restrict_to_workspace: config.restrict_to_workspace ?? true,
  });

  // Start agent in background
  (async () => {
    try {
      await sessionManager.init();
      await agent.run();
    } catch (error) {
      logger.error('Agent loop failed:', error);
    }
  })();

  logger.info('Agent initialized successfully');
  return agent;
}

// API Routes

// Get config
app.get('/api/config', (req: express.Request, res: express.Response) => {
  const config = loadConfig();
  res.json(config || {});
});

// Save config
app.post('/api/config', (req: express.Request, res: express.Response) => {
  try {
    const config = req.body as Config;
    saveConfig(config);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test connection
app.post('/api/config/test', async (req: express.Request, res: express.Response) => {
  try {
    const config = req.body as Config;
    let provider;
    
    switch (config.model.provider.toLowerCase()) {
      case 'volcengine':
      case 'doubao':
        provider = new VolcEngineProvider(config.model.api_key, config.model.base_url);
        break;
      case 'openai':
        provider = new OpenAIProvider(config.model.api_key, config.model.base_url);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.model.provider}`);
    }

    // Test with simple chat
    const response = await provider.chat([
      {
        role: 'user',
        content: 'Hello, please reply "Connection successful!" if you can hear me.',
      }
    ], undefined, config.model.model);

    if (response.content && response.content.includes('Connection successful')) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Connection test failed: Unexpected response' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Chat API
app.post('/api/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { message, session_key = 'web:default' } = req.body;
    
    if (!agent) {
      const config = loadConfig();
      if (!config) {
        return res.status(400).json({ success: false, message: '请先完成配置' });
      }
      initAgent(config);
    }

    if (!agent) {
      return res.status(500).json({ success: false, message: 'Agent initialization failed' });
    }

    const response = await agent.process_direct(message, session_key, 'web', 'default');
    res.json({ success: true, content: response });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(join(__dirname, '../../dist/web/index.html'));
});

// Start server
export function startServer() {
  app.listen(PORT, () => {
    logger.info(`🚀 nanobot web server started on http://localhost:${PORT}`);
    logger.info(`📁 Config file: ${CONFIG_PATH}`);
    
    // Auto init if config exists
    const config = loadConfig();
    if (config) {
      try {
        initAgent(config);
      } catch (error) {
        logger.error('Failed to auto initialize agent:', error);
      }
    }
  });
}

if (require.main === module) {
  startServer();
}

export { app };
