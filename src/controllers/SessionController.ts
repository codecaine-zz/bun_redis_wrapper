/**
 * SessionController
 * 
 * Production-ready session management with automatic expiration,
 * multi-device support, and security features.
 * 
 * @example
 * ```typescript
 * import { SessionController } from "./controllers/SessionController.ts";
 * 
 * const sessions = new SessionController(redis);
 * const sessionId = await sessions.create("user-123", { name: "Alice" });
 * const session = await sessions.get(sessionId);
 * ```
 */

import { RedisWrapper } from "../redis-wrapper";
import { createNamespacedRedis, type NamespacedRedisWrapper } from "../index";

export interface SessionData {
  userId: string;
  data: Record<string, any>;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionOptions {
  /** Session TTL in seconds (default: 86400 = 24 hours) */
  ttl?: number;
  /** IP address for security tracking */
  ipAddress?: string;
  /** User agent for device identification */
  userAgent?: string;
}

export class SessionController {
  private redis: NamespacedRedisWrapper;

  constructor(redis: RedisWrapper | NamespacedRedisWrapper, namespace: string = "session") {
    this.redis = redis instanceof RedisWrapper
      ? createNamespacedRedis(redis, namespace)
      : redis;
  }

  /**
   * Create a new session
   * 
   * @param userId - User identifier
   * @param data - Session data to store
   * @param options - Session options
   * @returns Session ID
   */
  async create(
    userId: string,
    data: Record<string, any>,
    options: SessionOptions = {}
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const ttl = options.ttl || 86400; // 24 hours default
    const now = Date.now();

    const sessionData: SessionData = {
      userId,
      data,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + (ttl * 1000),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    };

    // Store session
    await this.redis.setJSON(sessionId, sessionData, { EX: ttl });

    // Track session for user (for multi-device support)
    await this.redis.sadd(`user_sessions:${userId}`, sessionId);
    await this.redis.expire(`user_sessions:${userId}`, ttl);

    return sessionId;
  }

  /**
   * Get session data
   * 
   * @param sessionId - Session identifier
   * @returns Session data or null if not found/expired
   */
  async get(sessionId: string): Promise<SessionData | null> {
    const session = await this.redis.getJSON<SessionData>(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      await this.destroy(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Validate and update session activity
   * 
   * @param sessionId - Session identifier
   * @returns Updated session data or null
   */
  async validate(sessionId: string): Promise<SessionData | null> {
    const session = await this.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Update last activity
    session.lastActivityAt = Date.now();
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    
    if (ttl > 0) {
      await this.redis.setJSON(sessionId, session, { EX: ttl });
      return session;
    }

    return null;
  }

  /**
   * Extend session expiration
   * 
   * @param sessionId - Session identifier
   * @param additionalSeconds - Seconds to add to expiration
   * @returns Success status
   */
  async extend(sessionId: string, additionalSeconds: number): Promise<boolean> {
    const session = await this.get(sessionId);
    
    if (!session) {
      return false;
    }

    session.expiresAt += additionalSeconds * 1000;
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    
    if (ttl > 0) {
      await this.redis.setJSON(sessionId, session, { EX: ttl });
      return true;
    }

    return false;
  }

  /**
   * Destroy a session
   * 
   * @param sessionId - Session identifier
   */
  async destroy(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    
    if (session) {
      // Remove from user's session set
      await this.redis.srem(`user_sessions:${session.userId}`, sessionId);
    }

    await this.redis.del(sessionId);
  }

  /**
   * Destroy all sessions for a user (logout from all devices)
   * 
   * @param userId - User identifier
   * @returns Number of sessions destroyed
   */
  async destroyAllForUser(userId: string): Promise<number> {
    const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
    
    if (sessionIds.length === 0) {
      return 0;
    }

    // Delete all sessions
    await this.redis.del(...sessionIds);
    
    // Clear user's session set
    await this.redis.del(`user_sessions:${userId}`);

    return sessionIds.length;
  }

  /**
   * Get all active sessions for a user
   * 
   * @param userId - User identifier
   * @returns Array of session data
   */
  async getAllForUser(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get session count for a user
   * 
   * @param userId - User identifier
   * @returns Number of active sessions
   */
  async getSessionCount(userId: string): Promise<number> {
    return await this.redis.command<number>("SCARD", `user_sessions:${userId}`);
  }

  /**
   * Clean up expired sessions (run periodically)
   * 
   * @returns Number of sessions cleaned
   */
  async cleanupExpired(): Promise<number> {
    const keys = await this.redis.scanAll("*");
    let cleaned = 0;

    for (const key of keys) {
      if (key.startsWith("user_sessions:")) continue;
      const session = await this.redis.getJSON<SessionData>(key);
      if (!session || Date.now() > session.expiresAt) {
        await this.redis.del(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate a secure session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}${random2}`;
  }
}
