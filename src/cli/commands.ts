/**
 * CLI commands
 */
import { program } from 'commander';
import { AgentLoop } from '../agent/loop';
import { messageBus } from '../bus/queue';
import { OpenAIProvider } from '../providers/openai';
import { VolcEngineProvider } from '../providers/volcengine';
import { getSessionManager } from '../session/manager';
import { getCronService } from '../cron/service';
import { CliChannel } from '../channels/cli';
import { logger } from '../config/logger';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, homedir } from 'path';
import * as yaml from 'js-yaml';

const DEFAULT_WORKSPACE = join(homedir(), '.nanobot');
const DEFAULT_CONFIG_PATH = join(DEFAULT_WORKSPACE, 'config.yaml');

interface Config {
  model: {
    provider: string;
    api_key: string;
    model?: string;
    base_url?: string;
  };
  channels?: Array<{
    type: string;
    enabled: boolean;
    [key: string]: any;
  }>;
  workspace?: string;
  restrict_to_workspace?: boolean;
  max_iterations?: number;
}

function loadConfig(configPath?: string): Config {
  const path = configPath || DEFAULT_CONFIG_PATH;
  
  if (!existsSync(path)) {
    throw new Error(`Config file not found at ${path}. Run "nanobot config" to create one.`);
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return yaml.load(content) as Config;
  } catch (error) {
    throw new Error(`Failed to load config: ${(error as Error).message}`);
  }
}

async function startCommand(options: any) {
  try {
    const config = loadConfig(options.config);
    const workspace = config.workspace || DEFAULT_WORKSPACE;

    // Create workspace if it doesn't exist
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }

    // Initialize core services
    const sessionManager = getSessionManager(workspace);
    await sessionManager.init();

    const cronService = getCronService(messageBus, workspace);

    // Initialize LLM provider
    let provider;
    switch (config.model.provider.toLowerCase()) {
      case 'openai':
        provider = new OpenAIProvider(config.model.api_key, config.model.base_url);
        break;
      case 'volcengine':
      case 'doubao':
        provider = new VolcEngineProvider(config.model.api_key, config.model.base_url);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.model.provider}`);
    }

    // Initialize agent loop
    const agent = new AgentLoop({
      bus: messageBus,
      provider,
      workspace,
      model: config.model.model,
      session_manager: sessionManager,
      cron_service: cronService,
      max_iterations: config.max_iterations || 40,
      restrict_to_workspace: config.restrict_to_workspace ?? true,
    });

    // Start channels
    const channels = config.channels || [{ type: 'cli', enabled: true }];
    const activeChannels: any[] = [];

    for (const channelConfig of channels) {
      if (!channelConfig.enabled) continue;
      
      switch (channelConfig.type.toLowerCase()) {
        case 'cli':
          const cliChannel = new CliChannel();
          await cliChannel.start();
          activeChannels.push(cliChannel);
          break;
        default:
          logger.warn(`Unsupported channel type: ${channelConfig.type}, skipping`);
      }
    }

    if (activeChannels.length === 0) {
      throw new Error('No enabled channels configured');
    }

    // Start cron service
    cronService.start_all();

    // Start agent loop
    logger.info('nanobot-node is running! Press Ctrl+C to exit.');
    await agent.run();

  } catch (error) {
    logger.error('Failed to start nanobot:', error);
    process.exit(1);
  }
}

function configCommand() {
  console.log('📝 nanobot configuration wizard');
  console.log('Create a config file at ~/.nanobot/config.yaml with the following content:');
  console.log(`
# OpenAI 配置示例
model:
  provider: openai
  api_key: sk-xxx
  model: gpt-4o

# 火山引擎Doubao 配置示例（Coding Plan套餐）
# model:
#   provider: volcengine
#   api_key: 你的火山引擎API Key
#   model: doubao-coding-1.0
#   base_url: https://ark.cn-beijing.volces.com/api/v3

channels:
  - type: cli
    enabled: true

restrict_to_workspace: true
max_iterations: 40
`);
  console.log('\nThen run "nanobot start" to start the bot.');
}

function versionCommand() {
  const pkg = require('../../package.json');
  console.log(`nanobot-node v${pkg.version}`);
}

program
  .name('nanobot')
  .description('Ultra-lightweight personal AI assistant')
  .version('0.1.0', '-v, --version', 'Output version number');

program
  .command('start')
  .description('Start nanobot')
  .option('-c, --config <path>', 'Path to config file')
  .action(startCommand);

program
  .command('config')
  .description('Show configuration wizard')
  .action(configCommand);

program
  .command('version')
  .description('Show version information')
  .action(versionCommand);

// Default command: show help
program.parse(process.argv);

if (process.argv.length <= 2) {
  program.outputHelp();
}
