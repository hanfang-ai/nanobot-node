/**
 * Session manager - manages user sessions
 */
import { Session, Message } from '../types';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../config/logger';

interface SessionStore {
  sessions: Record<string, Session>;
}

export class SessionManager {
  private db: Low<SessionStore>;
  private readonly workspace: string;
  private readonly sessionsDir: string;

  constructor(workspace: string) {
    this.workspace = workspace;
    this.sessionsDir = join(workspace, 'sessions');
    
    // Create sessions directory if it doesn't exist
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
      logger.info(`Created sessions directory: ${this.sessionsDir}`);
    }

    // Initialize database
    const adapter = new JSONFile<SessionStore>(join(this.sessionsDir, 'sessions.json'));
    this.db = new Low(adapter, { sessions: {} });
  }

  /**
   * Initialize the session store
   */
  async init(): Promise<void> {
    await this.db.read();
    if (!this.db.data) {
      this.db.data = { sessions: {} };
      await this.db.write();
    }
    logger.info(`Session manager initialized, ${Object.keys(this.db.data.sessions).length} sessions loaded`);
  }

  /**
   * Get or create a session by key
   */
  get_or_create(sessionKey: string): Session {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }

    let session = this.db.data.sessions[sessionKey];
    if (!session) {
      session = {
        key: sessionKey,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.db.data.sessions[sessionKey] = session;
      logger.debug(`Created new session: ${sessionKey}`);
    }
    return session;
  }

  /**
   * Get a session by key
   */
  get(sessionKey: string): Session | undefined {
    return this.db.data?.sessions[sessionKey];
  }

  /**
   * Save a session
   */
  async save(session: Session): Promise<void> {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }

    session.updated_at = new Date().toISOString();
    this.db.data.sessions[session.key] = session;
    await this.db.write();
    logger.debug(`Saved session: ${session.key}`);
  }

  /**
   * Delete a session
   */
  async delete(sessionKey: string): Promise<boolean> {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }

    if (this.db.data.sessions[sessionKey]) {
      delete this.db.data.sessions[sessionKey];
      await this.db.write();
      logger.info(`Deleted session: ${sessionKey}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all sessions
   */
  async clear(): Promise<void> {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }

    this.db.data.sessions = {};
    await this.db.write();
    logger.info('All sessions cleared');
  }

  /**
   * List all sessions
   */
  listSessions(): Session[] {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }
    return Object.values(this.db.data.sessions);
  }

  /**
   * Generate a new session key
   */
  generateSessionKey(): string {
    return uuidv4();
  }

  /**
   * Archive old sessions (older than days)
   */
  async archiveOlderThan(days: number): Promise<number> {
    if (!this.db.data) {
      throw new Error('Session manager not initialized');
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let archived = 0;

    for (const [key, session] of Object.entries(this.db.data.sessions)) {
      if (new Date(session.updated_at).getTime() < cutoff) {
        delete this.db.data.sessions[key];
        archived++;
      }
    }

    if (archived > 0) {
      await this.db.write();
      logger.info(`Archived ${archived} sessions older than ${days} days`);
    }

    return archived;
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

export function getSessionManager(workspace?: string): SessionManager {
  if (!sessionManager) {
    if (!workspace) {
      throw new Error('Workspace path required for first session manager initialization');
    }
    sessionManager = new SessionManager(workspace);
  }
  return sessionManager;
}
