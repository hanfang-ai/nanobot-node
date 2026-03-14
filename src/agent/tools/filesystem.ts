/**
 * Filesystem tools - read, write, edit, list files
 */
import { BaseTool } from './base';
import { logger } from '../../config/logger';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { existsSync } from 'fs';

export class ReadFileTool extends BaseTool {
  name = 'read_file';
  description = 'Read the contents of a file';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (relative to workspace)',
      },
    },
    required: ['path'],
  };

  constructor(private readonly workspace: string, private readonly allowed_dir?: string) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const filePath = resolve(this.workspace, params.path);
    
    // Validate path is within allowed directory
    if (this.allowed_dir) {
      const relPath = relative(this.allowed_dir, filePath);
      if (relPath.startsWith('..') || relPath.startsWith('/')) {
        throw new Error('Access denied: Path outside allowed directory');
      }
    }

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${params.path}`);
    }

    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${params.path}`);
    }

    if (stats.size > 1024 * 1024) { // 1MB limit
      throw new Error('File too large (max 1MB)');
    }

    const content = await readFile(filePath, 'utf-8');
    logger.debug(`Read file: ${params.path}, ${content.length} bytes`);
    
    return content;
  }
}

export class WriteFileTool extends BaseTool {
  name = 'write_file';
  description = 'Write content to a file, overwriting if it exists';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write (relative to workspace)',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  };

  constructor(private readonly workspace: string, private readonly allowed_dir?: string) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const filePath = resolve(this.workspace, params.path);
    
    // Validate path is within allowed directory
    if (this.allowed_dir) {
      const relPath = relative(this.allowed_dir, filePath);
      if (relPath.startsWith('..') || relPath.startsWith('/')) {
        throw new Error('Access denied: Path outside allowed directory');
      }
    }

    await writeFile(filePath, params.content, 'utf-8');
    logger.debug(`Wrote file: ${params.path}, ${params.content.length} bytes`);
    
    return `Successfully wrote to ${params.path}`;
  }
}

export class ListDirTool extends BaseTool {
  name = 'list_dir';
  description = 'List files and directories in a directory';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list (relative to workspace, default: .)',
      },
    },
  };

  constructor(private readonly workspace: string, private readonly allowed_dir?: string) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const dirPath = resolve(this.workspace, params.path || '.');
    
    // Validate path is within allowed directory
    if (this.allowed_dir) {
      const relPath = relative(this.allowed_dir, dirPath);
      if (relPath.startsWith('..') || relPath.startsWith('/')) {
        throw new Error('Access denied: Path outside allowed directory');
      }
    }

    if (!existsSync(dirPath)) {
      throw new Error(`Directory not found: ${params.path || '.'}`);
    }

    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${params.path || '.'}`);
    }

    const entries = await readdir(dirPath, { withFileTypes: true });
    const result = entries.map(entry => {
      const type = entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : 'l';
      return `${type} ${entry.name}`;
    }).join('\n');

    logger.debug(`Listed directory: ${params.path || '.'}, ${entries.length} entries`);
    
    return result;
  }
}
