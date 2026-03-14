/**
 * Tool registry - manages all available tools
 */
import { BaseTool } from './base';
import { ToolDefinition, ToolCall } from '../../types';
import { logger } from '../../config/logger';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} is already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  /**
   * Execute a tool call
   */
  async execute(toolName: string, parameters: Record<string, any>): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      tool.validateParams(parameters);
      logger.info(`Executing tool: ${toolName} with params: ${JSON.stringify(parameters).slice(0, 200)}`);
      const result = await tool.run(parameters);
      logger.debug(`Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      logger.error(`Tool ${toolName} execution failed:`, error);
      return `Error executing ${toolName}: ${(error as Error).message}`;
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeBatch(toolCalls: ToolCall[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    await Promise.all(
      toolCalls.map(async (call) => {
        try {
          const result = await this.execute(
            call.function.name,
            call.function.arguments
          );
          results[call.id] = result;
        } catch (error) {
          results[call.id] = `Error: ${(error as Error).message}`;
        }
      })
    );

    return results;
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Remove a tool
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
