/**
 * Shell execution tool
 */
import { BaseTool } from './base';
import { logger } from '../../config/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, relative } from 'path';

const execAsync = promisify(exec);

export class ExecTool extends BaseTool {
  name = 'exec';
  description = 'Execute a shell command and return the output';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        minimum: 1000,
        maximum: 300000,
      },
    },
    required: ['command'],
  };

  constructor(
    private readonly working_dir: string,
    private readonly timeout: number = 30000,
    private readonly restrict_to_workspace: boolean = true,
    private readonly path_append?: string
  ) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const command = params.command;
    const timeout = params.timeout || this.timeout;

    // Block dangerous commands
    const dangerousCommands = [
      'rm -rf /',
      'mkfs',
      'dd if=',
      '>:',
      '> /dev/sd',
      'chmod 777 /',
      'su',
      'sudo',
      'passwd',
      'shutdown',
      'reboot',
      'halt',
      'poweroff',
      'mv /',
      'cp /dev/null',
      'curl | bash',
      'wget | bash',
    ];

    for (const dangerous of dangerousCommands) {
      if (command.includes(dangerous)) {
        throw new Error(`Command blocked for security: "${dangerous}"`);
      }
    }

    logger.info(`Executing command: ${command.slice(0, 200)}`);

    // Set working directory and environment
    const options = {
      cwd: this.working_dir,
      timeout,
      env: {
        ...process.env,
        PATH: this.path_append ? `${process.env.PATH}:${this.path_append}` : process.env.PATH,
      },
      maxBuffer: 1024 * 1024, // 1MB output limit
    };

    try {
      const { stdout, stderr } = await execAsync(command, options);
      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
      
      // Truncate long output
      if (output.length > 16000) {
        return output.slice(0, 16000) + '\n... (output truncated)';
      }
      
      return output;
    } catch (error: any) {
      const exitCode = error.code || 'unknown';
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      
      return `Command failed with exit code ${exitCode}:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
    }
  }
}
