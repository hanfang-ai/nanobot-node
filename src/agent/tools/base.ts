/**
 * Base tool class
 */
import { ToolDefinition } from '../../types';

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };

  /**
   * Execute the tool with given parameters
   */
  abstract run(params: Record<string, any>): Promise<string>;

  /**
   * Get tool definition for LLM
   */
  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  /**
   * Validate parameters against schema
   */
  validateParams(params: Record<string, any>): boolean {
    // Basic validation - check required parameters
    const required = this.parameters.required || [];
    for (const param of required) {
      if (params[param] === undefined) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
    return true;
  }
}
