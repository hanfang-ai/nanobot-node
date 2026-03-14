/**
 * Message tool - send messages to channels
 */
import { BaseTool } from './base';
import { OutboundMessage } from '../../types';
import { logger } from '../../config/logger';

export class MessageTool extends BaseTool {
  name = 'send_message';
  description = 'Send a message to a user or chat';
  parameters = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Message content to send',
      },
      channel: {
        type: 'string',
        description: 'Channel to send to (default: current channel)',
      },
      chat_id: {
        type: 'string',
        description: 'Chat ID to send to (default: current chat)',
      },
    },
    required: ['content'],
  };

  private current_channel?: string;
  private current_chat_id?: string;
  private _sent_in_turn: boolean = false;

  constructor(private readonly send_callback: (msg: OutboundMessage) => Promise<void>) {
    super();
  }

  /**
   * Set context for the current turn
   */
  set_context(channel: string, chat_id: string): void {
    this.current_channel = channel;
    this.current_chat_id = chat_id;
    this._sent_in_turn = false;
  }

  /**
   * Mark start of a new turn
   */
  start_turn(): void {
    this._sent_in_turn = false;
  }

  get sent_in_turn(): boolean {
    return this._sent_in_turn;
  }

  async run(params: Record<string, any>): Promise<string> {
    const content = params.content;
    const channel = params.channel || this.current_channel;
    const chat_id = params.chat_id || this.current_chat_id;

    if (!channel || !chat_id) {
      throw new Error('Channel and chat_id are required (either pass as parameters or set context)');
    }

    logger.info(`Sending message to ${channel}:${chat_id}: ${content.slice(0, 100)}`);

    try {
      await this.send_callback({
        channel,
        chat_id,
        content,
      });
      this._sent_in_turn = true;
      return 'Message sent successfully';
    } catch (error: any) {
      return `Failed to send message: ${error.message}`;
    }
  }
}
