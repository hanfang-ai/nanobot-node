/**
 * nanobot-node entry point
 */
import { AgentLoop } from './agent/loop';
import { messageBus } from './bus/queue';
import { OpenAIProvider } from './providers/openai';
import { getSessionManager } from './session/manager';
import { getCronService } from './cron/service';
import { logger } from './config/logger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventType } from './bus/events';
const homedir = require('os').homedir;

// Default workspace directory
const DEFAULT_WORKSPACE = join(homedir(), '.nanobot');

async function main() {
  try {
    logger.info('🐈 nanobot-node starting...');

    // Create workspace directory if it doesn't exist
    const workspace = process.env.NANOBOT_WORKSPACE || DEFAULT_WORKSPACE;
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
      logger.info(`Created workspace directory: ${workspace}`);
    }

    // Initialize core services
    const sessionManager = getSessionManager(workspace);
    await sessionManager.init();

    const cronService = getCronService(messageBus, workspace);

    // Initialize LLM provider (this should be loaded from config in production)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    const provider = new OpenAIProvider(apiKey);

    // Initialize agent loop
    const agent = new AgentLoop({
      bus: messageBus,
      provider,
      workspace,
      session_manager: sessionManager,
      cron_service: cronService,
      max_iterations: 40,
      restrict_to_workspace: true,
    });

    // Handle outbound messages (in production, this would be handled by channel adapters)
    messageBus.subscribe(EventType.OUTBOUND_MESSAGE, (msg: any) => {
      if (!msg.metadata?._progress) { // Don't log progress messages
        logger.info(`Outbound message to ${msg.channel}:${msg.chat_id}: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      }
    });

    // Start cron service
    cronService.start_all();

    // Start agent loop
    await agent.run();

  } catch (error) {
    logger.error('Failed to start nanobot-node:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  const cronService = getCronService();
  cronService.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  const cronService = getCronService();
  cronService.destroy();
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  main();
}

export { AgentLoop, messageBus, OpenAIProvider, getSessionManager, getCronService };
