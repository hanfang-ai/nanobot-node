/**
 * Base channel class
 */
import { OutboundMessage } from '../types';
import { messageBus } from '../bus/queue';
import { logger } from '../config/logger';

export abstract class BaseChannel {
  abstract name: string;
  abstract enabled: boolean;

  /**
   * Start the channel
   */
  abstract start(): Promise<void>;

  /**
   * Send a message through this channel
   */
  abstract send_message(chat_id: string, content: string, options?: Record<string, any>): Promise<void>;

  /**
   * Stop the channel
   */
  async stop(): Promise<void> {
    logger.info(`Stopped channel: ${this.name}`);
  }

  /**
   * Register outbound message handler
   */
  protected registerOutboundHandler(): void {
    messageBus.subscribe('outbound:message', async (msg: OutboundMessage) => {
      if (msg.channel === this.name && this.enabled) {
        try {
          await this.send_message(msg.chat_id, msg.content, msg.metadata);
        } catch (error) {
          logger.error(`Failed to send message via ${this.name}:`, error);
        }
      }
    });
    logger.debug(`Registered outbound handler for channel: ${this.name}`);
  }
}
