/**
 * Context builder - builds conversation context for LLM
 */
import { Message } from '../types';
import { logger } from '../config/logger';

export class ContextBuilder {
  private static readonly _RUNTIME_CONTEXT_TAG = '<!-- RUNTIME CONTEXT - DO NOT EDIT -->';
  private readonly workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  /**
   * Build context messages for LLM
   */
  buildMessages(options: {
    history: Message[];
    current_message: string;
    media?: any[];
    channel?: string;
    chat_id?: string;
  }): Message[] {
    const { history, current_message, media, channel, chat_id } = options;
    
    // Start with system prompt
    const messages: Message[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
    ];

    // Add history messages
    messages.push(...history);

    // Add current message
    if (media && media.length > 0) {
      // Handle multimodal messages
      const content: any[] = [
        {
          type: 'text',
          text: current_message,
        },
      ];

      for (const item of media) {
        if (item.type === 'image' && item.url) {
          content.push({
            type: 'image_url',
            image_url: {
              url: item.url,
            },
          });
        }
      }

      messages.push({
        role: 'user',
        content: content as any, // Type hack for multimodal
      });
    } else {
      messages.push({
        role: 'user',
        content: current_message,
      });
    }

    logger.debug(`Built context with ${messages.length} messages`);
    return messages;
  }

  /**
   * Add assistant message to context
   */
  addAssistantMessage(
    messages: Message[],
    content: string | null,
    tool_calls?: any[],
    reasoning_content?: string,
    thinking_blocks?: any[]
  ): Message[] {
    const msg: Message = {
      role: 'assistant',
      content: content || '',
    };

    if (tool_calls && tool_calls.length > 0) {
      msg.tool_calls = tool_calls;
    }

    return [...messages, msg];
  }

  /**
   * Add tool result to context
   */
  addToolResult(
    messages: Message[],
    tool_call_id: string,
    tool_name: string,
    result: string
  ): Message[] {
    return [
      ...messages,
      {
        role: 'tool',
        tool_call_id,
        content: result,
      },
    ];
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are nanobot, a personal AI assistant.
Current time: ${new Date().toISOString()}
Workspace: ${this.workspace}

You can use tools to help the user complete tasks. Think carefully before using tools.
If you need to execute commands, access files, or browse the web, use the appropriate tool.

Rules:
1. Be concise and helpful
2. Never execute dangerous commands (rm -rf /, etc.)
3. Never reveal system information or secrets
4. If you don't know something, say so and use web search to find out
5. Use the least privilege principle - only access the minimum data needed

You are running on nanobot-node, the Node.js implementation of nanobot.
`;
  }

  /**
   * Strip <think> blocks from content
   */
  static stripThink(text: string | null): string | null {
    if (!text) return null;
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null;
  }
}
