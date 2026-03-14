/**
 * OpenAI LLM provider
 */
import { LLMProvider } from './base';
import { Message, LLMResponse, ToolDefinition } from '../types';
import { logger } from '../config/logger';
import OpenAI from 'openai';

export class OpenAIProvider extends LLMProvider {
  name = 'openai';
  defaultModel = 'gpt-4o';
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    logger.info('OpenAI provider initialized');
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    model?: string,
    options?: Record<string, any>
  ): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);
    const formattedTools = this.formatTools(tools);

    logger.debug(`Calling OpenAI model: ${model || this.defaultModel}, ${messages.length} messages`);

    const response = await this.client.chat.completions.create({
      model: model || this.defaultModel,
      messages: formattedMessages,
      tools: formattedTools,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
      stream: false,
      ...options,
    });

    const choice = response.choices[0];
    const content = choice.message.content || null;
    const toolCalls = this.parseToolCalls(response);

    logger.debug(`OpenAI response received, finish reason: ${choice.finish_reason}, has_tool_calls: ${toolCalls.length > 0}`);

    return {
      content,
      has_tool_calls: toolCalls.length > 0,
      tool_calls: toolCalls,
      finish_reason: choice.finish_reason || 'stop',
      reasoning_content: undefined,
      thinking_blocks: undefined,
    };
  }
}
