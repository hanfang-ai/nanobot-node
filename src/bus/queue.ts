/**
 * Message bus implementation
 */
import { EventEmitter } from 'events';
import { BusEvent, EventType, InboundMessage, OutboundMessage } from './events';
import { logger } from '../config/logger';

export class MessageBus {
  private emitter: EventEmitter;
  private inboundQueue: InboundMessage[] = [];
  private outboundQueue: OutboundMessage[] = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publish an event to the bus
   */
  publish(event: BusEvent): void {
    logger.debug(`Publishing event: ${event.type}`);
    this.emitter.emit(event.type, event.payload);
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(eventType: EventType, handler: (payload: T) => void | Promise<void>): void {
    this.emitter.on(eventType, async (payload: T) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`Error handling event ${eventType}:`, error);
        this.publish({
          type: EventType.ERROR,
          payload: {
            error: error as Error,
            context: { eventType },
          },
        });
      }
    });
  }

  /**
   * Publish an inbound message
   */
  publish_inbound(message: InboundMessage): void {
    this.inboundQueue.push(message);
    this.publish({
      type: EventType.INBOUND_MESSAGE,
      payload: message,
    });
  }

  /**
   * Publish an outbound message
   */
  publish_outbound(message: OutboundMessage): void {
    this.outboundQueue.push(message);
    this.publish({
      type: EventType.OUTBOUND_MESSAGE,
      payload: message,
    });
  }

  /**
   * Consume next inbound message (async)
   */
  async consume_inbound(timeout: number = 1000): Promise<InboundMessage | null> {
    if (this.inboundQueue.length > 0) {
      return this.inboundQueue.shift()!;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);
      
      const handler = (message: InboundMessage) => {
        clearTimeout(timer);
        this.emitter.off(EventType.INBOUND_MESSAGE, handler);
        // Remove from queue if it's still there (might have been taken by another consumer)
        const index = this.inboundQueue.indexOf(message);
        if (index > -1) {
          this.inboundQueue.splice(index, 1);
        }
        resolve(message);
      };

      this.emitter.on(EventType.INBOUND_MESSAGE, handler);
    });
  }

  /**
   * Get queue stats
   */
  getStats(): { inboundSize: number; outboundSize: number } {
    return {
      inboundSize: this.inboundQueue.length,
      outboundSize: this.outboundQueue.length,
    };
  }
}

// Singleton instance
export const messageBus = new MessageBus();
