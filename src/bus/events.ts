/**
 * Event types for message bus
 */
import { InboundMessage, OutboundMessage } from '../types';

export enum EventType {
  INBOUND_MESSAGE = 'inbound:message',
  OUTBOUND_MESSAGE = 'outbound:message',
  TOOL_CALL = 'tool:call',
  TOOL_RESULT = 'tool:result',
  ERROR = 'error',
}

export interface InboundMessageEvent {
  type: EventType.INBOUND_MESSAGE;
  payload: InboundMessage;
}

export interface OutboundMessageEvent {
  type: EventType.OUTBOUND_MESSAGE;
  payload: OutboundMessage;
}

export interface ToolCallEvent {
  type: EventType.TOOL_CALL;
  payload: {
    tool_name: string;
    parameters: Record<string, any>;
    call_id: string;
  };
}

export interface ToolResultEvent {
  type: EventType.TOOL_RESULT;
  payload: {
    call_id: string;
    result: string;
    error?: string;
  };
}

export interface ErrorEvent {
  type: EventType.ERROR;
  payload: {
    error: Error;
    context?: Record<string, any>;
  };
}

export type BusEvent =
  | InboundMessageEvent
  | OutboundMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent;
