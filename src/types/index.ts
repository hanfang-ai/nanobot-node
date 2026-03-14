/**
 * Common types for nanobot-node
 */

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface InboundMessage {
  channel: string;
  sender_id: string;
  chat_id: string;
  content: string;
  media?: Media[];
  metadata?: Record<string, any>;
  session_key?: string;
}

export interface OutboundMessage {
  channel: string;
  chat_id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface Media {
  type: 'image' | 'file' | 'audio' | 'video';
  url?: string;
  data?: string;
  mime_type?: string;
  name?: string;
}

export interface Session {
  key: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string | null;
  has_tool_calls: boolean;
  tool_calls: ToolCall[];
  finish_reason: string;
  reasoning_content?: string;
  thinking_blocks?: any[];
}
