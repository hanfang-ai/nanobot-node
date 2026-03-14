/**
 * CLI channel - interactive command line interface
 */
import { BaseChannel } from './base';
import { messageBus } from '../bus/queue';
import { logger } from '../config/logger';
import * as readline from 'readline';
import { stdin, stdout } from 'process';

export class CliChannel extends BaseChannel {
  name = 'cli';
  enabled = true;
  private rl: readline.Interface | null = null;
  private chat_id = 'cli:default';

  async start(): Promise<void> {
    logger.info('Starting CLI channel');

    // Create readline interface
    this.rl = readline.createInterface({
      input: stdin,
      output: stdout,
      prompt: '> ',
      completer: (line: string) => {
        const completions = ['/help', '/new', '/stop', '/restart', '/exit'];
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      },
    });

    // Handle input
    this.rl.on('line', (line: string) => {
      const input = line.trim();
      
      if (input === '/exit' || input === '/quit') {
        this.rl?.close();
        process.exit(0);
      }

      if (input) {
        messageBus.publish_inbound({
          channel: this.name,
          sender_id: 'cli:user',
          chat_id: this.chat_id,
          content: input,
        });
      }

      this.rl?.prompt();
    });

    this.rl.on('close', () => {
      logger.info('CLI channel closed');
      process.exit(0);
    });

    // Register outbound handler
    this.registerOutboundHandler();

    // Show welcome message
    console.log('\n🐈 Welcome to nanobot-node!');
    console.log('Type /help for available commands, /exit to quit.\n');
    this.rl.prompt();
  }

  async send_message(chat_id: string, content: string, options?: Record<string, any>): Promise<void> {
    // Don't show progress messages in CLI
    if (options?._progress) {
      if (options._tool_hint) {
        readline.clearLine(stdout, 0);
        readline.cursorTo(stdout, 0);
        process.stdout.write(`🔧 ${content}\r`);
      }
      return;
    }

    // Clear any pending output
    readline.clearLine(stdout, 0);
    readline.cursorTo(stdout, 0);
    
    // Print response
    console.log(content);
    console.log();
    
    // Reprompt
    this.rl?.prompt();
  }

  async stop(): Promise<void> {
    this.rl?.close();
    await super.stop();
  }
}
