/**
 * Web tools - fetch and search
 */
import { BaseTool } from './base';
import { logger } from '../../config/logger';
import axios from 'axios';
import { load } from 'cheerio';
import * as ddg from 'duck-duck-scrape';

export class WebFetchTool extends BaseTool {
  name = 'web_fetch';
  description = 'Fetch and extract readable content from a URL';
  parameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch',
      },
      max_chars: {
        type: 'number',
        description: 'Maximum characters to return (default: 10000)',
        minimum: 100,
        maximum: 50000,
      },
    },
    required: ['url'],
  };

  constructor(private readonly proxy?: string) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const url = params.url;
    const maxChars = params.max_chars || 10000;

    logger.info(`Fetching URL: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        proxy: this.proxy ? {
          host: this.proxy.split(':')[0],
          port: parseInt(this.proxy.split(':')[1]),
        } : undefined,
        timeout: 10000,
        responseType: 'text',
      });

      // Extract readable content from HTML
      const $ = load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, footer, header, aside, iframe, noscript').remove();
      
      // Get text content
      let text = $('body').text()
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();

      // Truncate if needed
      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '... (content truncated)';
      }

      logger.debug(`Fetched URL: ${url}, ${text.length} bytes`);
      return text;
    } catch (error: any) {
      return `Failed to fetch URL: ${error.message}`;
    }
  }
}

export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = 'Search the web for information using DuckDuckGo';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (default: 5)',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  };

  constructor(private readonly config?: any, private readonly proxy?: string) {
    super();
  }

  async run(params: Record<string, any>): Promise<string> {
    const query = params.query;
    const numResults = params.num_results || 5;

    logger.info(`Searching web for: "${query}"`);

    try {
      const results = await ddg.text(query, {
        maxResults: numResults,
      });

      if (!results || results.length === 0) {
        return 'No results found.';
      }

      const formatted = results.map((result: any, index: number) => {
        return `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.body.slice(0, 200)}...\n`;
      }).join('\n');

      logger.debug(`Search returned ${results.length} results for "${query}"`);
      return formatted;
    } catch (error: any) {
      return `Search failed: ${error.message}`;
    }
  }
}
