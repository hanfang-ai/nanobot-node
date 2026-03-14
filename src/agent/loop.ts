/**
 * Agent loop: the core processing engine
 */
import { MessageBus } from '../bus/queue';
import { LLMProvider } from '../providers/base';
import { SessionManager } from '../session/manager';
import { ToolRegistry } from './tools/registry';
import { ContextBuilder } from './context';
import { InboundMessage, OutboundMessage, Message, ToolCall } from '../types';
import { logger } from '../config/logger';
import { CronService } from '../cron/service';
import { ReadFileTool, WriteFileTool, ListDirTool } from './tools/filesystem';
import { ExecTool } from './tools/shell';
import { WebFetchTool, WebSearchTool } from './tools/web';
import { MessageTool } from './tools/message';

interface AgentLoopConfig {
  bus: MessageBus;
  provider: LLMProvider;
  workspace: string;
  model?: string;
  max_iterations?: number;
  context_window_tokens?: number;
  restrict_to_workspace?: boolean;
  cron_service?: CronService;
  session_manager?: SessionManager;
}

export class AgentLoop {
  private readonly bus: MessageBus;
  private readonly provider: LLMProvider;
  private readonly workspace: string;
  private readonly model: string;
  private readonly max_iterations: number;
  private readonly context_window_tokens: number;
  private readonly restrict_to_workspace: boolean;
  private readonly cron_service?: CronService;

  private readonly context: ContextBuilder;
  private readonly sessions: SessionManager;
  private readonly tools: ToolRegistry;
  private _running: boolean = false;
  private _processing_lock: Promise<void> = Promise.resolve();

  private static readonly _TOOL_RESULT_MAX_CHARS = 16_000;

  constructor(config: AgentLoopConfig) {
    this.bus = config.bus;
    this.provider = config.provider;
    this.workspace = config.workspace;
    this.model = config.model || config.provider.get_default_model();
    this.max_iterations = config.max_iterations || 40;
    this.context_window_tokens = config.context_window_tokens || 65536;
    this.restrict_to_workspace = config.restrict_to_workspace || false;
    this.cron_service = config.cron_service;

    this.context = new ContextBuilder(this.workspace);
    this.sessions = config.session_manager || new SessionManager(this.workspace);
    this.tools = new ToolRegistry();

    // Register default tools
    this._register_default_tools();
    logger.info('Agent loop initialized');
  }

  /**
   * Register default built-in tools
   */
  private _register_default_tools(): void {
    const allowed_dir = this.restrict_to_workspace ? this.workspace : undefined;
    
    // Filesystem tools
    this.tools.register(new ReadFileTool(this.workspace, allowed_dir));
    this.tools.register(new WriteFileTool(this.workspace, allowed_dir));
    this.tools.register(new ListDirTool(this.workspace, allowed_dir));
    
    // Shell execution
    this.tools.register(new ExecTool(
      this.workspace,
      30000,
      this.restrict_to_workspace
    ));
    
    // Web tools
    this.tools.register(new WebFetchTool());
    this.tools.register(new WebSearchTool());
    
    // Message tool
    this.tools.register(new MessageTool(this.bus.publish_outbound.bind(this.bus)));
    
    logger.info('Default tools registered: read_file, write_file, list_dir, exec, web_fetch, web_search, send_message');
  }

  /**
   * Strip <think> blocks from content
   */
  private static _strip_think(text: string | null): string | null {
    if (!text) return null;
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null;
  }

  /**
   * Format tool calls as concise hint
   */
  private static _tool_hint(tool_calls: ToolCall[]): string {
    const fmt = (tc: ToolCall) => {
      const args = tc.function.arguments || {};
      const val = Object.values(args)[0];
      if (!val || typeof val !== 'string') return tc.function.name;
      return `${tc.function.name}("${val.length > 40 ? val.slice(0, 40) + '…' : val}")`;
    };
    return tool_calls.map(fmt).join(', ');
  }

  /**
   * Run the agent iteration loop
   */
  private async _run_agent_loop(
    initial_messages: Message[],
    on_progress?: (content: string, tool_hint?: boolean) => Promise<void>
  ): Promise<{ final_content: string | null; tools_used: string[]; messages: Message[] }> {
    const messages: Message[] = [...initial_messages];
    let iteration = 0;
    let final_content: string | null = null;
    const tools_used: string[] = [];

    while (iteration < this.max_iterations) {
      iteration++;
      logger.debug(`Agent loop iteration ${iteration}/${this.max_iterations}`);

      const tool_defs = this.tools.getDefinitions();
      
      const response = await this.provider.chat_with_retry(
        messages,
        tool_defs.length > 0 ? tool_defs : undefined,
        this.model
      );

      if (response.has_tool_calls) {
        if (on_progress) {
          const thought = AgentLoop._strip_think(response.content);
          if (thought) {
            await on_progress(thought);
          }
          await on_progress(AgentLoop._tool_hint(response.tool_calls), true);
        }

        // Convert to OpenAI tool call format
        const tool_call_dicts = response.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        }));

        // Add assistant message with tool calls to context
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: tool_call_dicts,
        });

        // Execute all tool calls
        for (const tool_call of response.tool_calls) {
          tools_used.push(tool_call.function.name);
          const args_str = JSON.stringify(tool_call.function.arguments);
          logger.info(`Tool call: ${tool_call.function.name}(${args_str.slice(0, 200)})`);

          const result = await this.tools.execute(
            tool_call.function.name,
            tool_call.function.arguments
          );

          // Truncate long tool results
          const truncated_result = result.length > AgentLoop._TOOL_RESULT_MAX_CHARS
            ? result.slice(0, AgentLoop._TOOL_RESULT_MAX_CHARS) + '\n... (truncated)'
            : result;

          // Add tool result to context
          messages.push({
            role: 'tool',
            tool_call_id: tool_call.id,
            content: truncated_result,
          });
        }
      } else {
        // No more tool calls, return final response
        const clean_content = AgentLoop._strip_think(response.content);
        
        if (response.finish_reason === 'error') {
          logger.error(`LLM returned error: ${clean_content || ''}`);
          final_content = clean_content || 'Sorry, I encountered an error calling the AI model.';
        } else {
          messages.push({
            role: 'assistant',
            content: clean_content || '',
          });
          final_content = clean_content;
        }
        break;
      }
    }

    if (final_content === null && iteration >= this.max_iterations) {
      logger.warning(`Max iterations (${this.max_iterations}) reached`);
      final_content = `I reached the maximum number of tool call iterations (${this.max_iterations}) without completing the task. You can try breaking the task into smaller steps.`;
    }

    return {
      final_content,
      tools_used,
      messages,
    };
  }

  /**
   * Process a single inbound message
   */
  private async _process_message(msg: InboundMessage): Promise<OutboundMessage | null> {
    logger.info(`Processing message from ${msg.channel}:${msg.sender_id}: ${msg.content.slice(0, 80)}${msg.content.length > 80 ? '...' : ''}`);

    const session_key = msg.session_key || `${msg.channel}:${msg.chat_id}`;
    const session = this.sessions.get_or_create(session_key);

    // Handle slash commands
    const cmd = msg.content.trim().toLowerCase();
    if (cmd === '/new') {
      session.messages = [];
      await this.sessions.save(session);
      return {
        channel: msg.channel,
        chat_id: msg.chat_id,
        content: 'New session started.',
      };
    } else if (cmd === '/help') {
      const help_text = [
        '🐈 nanobot commands:',
        '/new — Start a new conversation',
        '/stop — Stop the current task',
        '/restart — Restart the bot',
        '/help — Show available commands',
        '',
        'Available tools:',
        '• read_file <path> — Read file content',
        '• write_file <path> <content> — Write content to file',
        '• list_dir [path] — List directory contents',
        '• exec <command> — Execute shell command',
        '• web_fetch <url> — Fetch web page content',
        '• web_search <query> — Search the web',
        '• send_message <content> — Send message to current chat',
      ].join('\n');
      return {
        channel: msg.channel,
        chat_id: msg.chat_id,
        content: help_text,
      };
    }

    // Build context messages
    const initial_messages = this.context.build_messages({
      history: session.messages,
      current_message: msg.content,
      media: msg.media,
      channel: msg.channel,
      chat_id: msg.chat_id,
    });

    // Progress callback
    const on_progress = async (content: string, tool_hint: boolean = false) => {
      await this.bus.publish_outbound({
        channel: msg.channel,
        chat_id: msg.chat_id,
        content,
        metadata: {
          _progress: true,
          _tool_hint: tool_hint,
          ...msg.metadata,
        },
      });
    };

    // Run agent loop
    const { final_content, messages } = await this._run_agent_loop(
      initial_messages,
      on_progress
    );

    if (!final_content) {
      final_content = "I've completed processing but have no response to give.";
    }

    // Save new messages to session
    const new_messages = messages.slice(session.messages.length + 1); // Skip system prompt and old history
    session.messages.push(...new_messages);
    await this.sessions.save(session);

    logger.info(`Response to ${msg.channel}:${msg.sender_id}: ${final_content.slice(0, 120)}${final_content.length > 120 ? '...' : ''}`);

    return {
      channel: msg.channel,
      chat_id: msg.chat_id,
      content: final_content,
      metadata: msg.metadata,
    };
  }

  /**
   * Start the agent loop
   */
  async run(): Promise<void> {
    this._running = true;
    await this.sessions.init();
    logger.info('Agent loop started');

    while (this._running) {
      try {
        // Wait for processing lock to ensure sequential processing
        await this._processing_lock;

        const msg = await this.bus.consume_inbound(1000);
        if (!msg) continue;

        // Handle special commands
        if (msg.content.trim().toLowerCase() === '/stop') {
          await this.bus.publish_outbound({
            channel: msg.channel,
            chat_id: msg.chat_id,
            content: 'Stop command received. Current task cancelled.',
          });
          continue;
        }

        // Process message in background
        this._processing_lock = (async () => {
          try {
            const response = await this._process_message(msg);
            if (response) {
              await this.bus.publish_outbound(response);
            }
          } catch (error) {
            logger.error('Error processing message:', error);
            await this.bus.publish_outbound({
              channel: msg.channel,
              chat_id: msg.chat_id,
              content: 'Sorry, I encountered an error processing your request.',
            });
          }
        })();
      } catch (error) {
        logger.error('Error in agent loop:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Stop the agent loop
   */
  stop(): void {
    this._running = false;
    logger.info('Agent loop stopping');
  }

  /**
   * Process a message directly (for CLI or programmatic use)
   */
  async process_direct(
    content: string,
    session_key: string = 'cli:direct',
    channel: string = 'cli',
    chat_id: string = 'direct'
  ): Promise<string> {
    const response = await this._process_message({
      channel,
      sender_id: 'user',
      chat_id,
      content,
      session_key,
    });
    return response?.content || '';
  }
}
