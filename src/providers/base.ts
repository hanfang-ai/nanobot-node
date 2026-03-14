/**
 * Base LLM provider class
 */
import { Message, LLMResponse, ToolDefinition, ToolCall } from '../types';
import { logger } from '../config/logger';

export abstract class LLMProvider {
  abstract name: string;
  abstract defaultModel: string;

  /**
   * Chat with the LLM
   */
  abstract chat(
    messages: Message[],
    tools?: ToolDefinition[],
    model?: string,
    options?: Record<string, any>
  ): Promise<LLMResponse>;

  /**
   * Chat with retry logic
   */
  async chat_with_retry(
    messages: Message[],
    tools?: ToolDefinition[],
    model?: string,
    maxRetries: number = 3,
    options?: Record<string, any>
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.chat(messages, tools, model, options);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`LLM chat attempt ${i + 1} failed: ${lastError.message}`);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }

    logger.error(`All ${maxRetries} LLM chat attempts failed`);
    throw lastError || new Error('LLM chat failed after all retries');
  }

  /**
   * Get default model for this provider
   */
  get_default_model(): string {
    return this.defaultModel;
  }

  /**
   * Parse tool calls from LLM response
   */
  protected parseToolCalls(response: any): ToolCall[] {
    // Default implementation for OpenAI format
    if (response.choices && response.choices[0].message.tool_calls) {
      return response.choices[0].message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        },
      }));
    }
    return [];
  }

  /**
   * Convert messages to provider-specific format
   */
  protected formatMessages(messages: Message[]): any[] {
    // Default implementation for OpenAI format
    return messages.map(msg => {
      const formatted: any = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls;
      }

      if (msg.tool_call_id) {
        formatted.tool_call_id = msg.tool_call_id;
      }

      return formatted;
    });
  }

  /**
   * Convert tool definitions to provider-specific format
   */
  protected formatTools(tools?: ToolDefinition[]): any[] | undefined {
    return tools;
  }
}
