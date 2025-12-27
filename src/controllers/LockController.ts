/**
 * LockController
 * 
 * Distributed locks to prevent race conditions and ensure only one
 * process accesses a critical section at a time.
 * 
 * Perfect for: Payment processing, inventory updates, file uploads, data migrations
 * 
 * @example
 * ```typescript
 * import { LockController } from "./controllers/LockController";
 * 
 * const locks = new LockController(redis);
 * 
 * // Acquire a lock before critical operation
 * const lock = await locks.acquire("payment:order123", 30);
 * if (lock) {
 *   try {
 *     await processPayment(order);
 *   } finally {
 *     await locks.release("payment:order123", lock);
 *   }
 * }
 * ```
 */

import type { RedisWrapper } from "../index";
import { createNamespacedRedis } from "../index";

export interface LockOptions {
  /** Lock timeout in seconds (default: 30) */
  timeout?: number;
  /** Retry attempts if lock is held (default: 0) */
  retries?: number;
  /** Delay between retries in ms (default: 100) */
  retryDelay?: number;
}

/**
 * LockController for distributed locking
 * 
 * Prevents race conditions in distributed systems by ensuring
 * only one process can hold a lock at a time.
 */
export class LockController {
  private redis: ReturnType<typeof createNamespacedRedis>;

  constructor(redis: RedisWrapper) {
    this.redis = createNamespacedRedis(redis, "locks");
  }

  /**
   * Acquire a lock
   * 
   * Best Practice: Always use try/finally to ensure lock is released
   * Tip: Keep lock duration as short as possible
   * 
   * @param key - Unique identifier for the lock
   * @param options - Lock configuration
   * @returns Lock token if acquired, null if failed
   * 
   * @example
   * ```typescript
   * // Simple lock
   * const lock = await locks.acquire("process-job-123");
   * if (!lock) {
   *   console.log("Another process is already working on this");
   *   return;
   * }
   * 
   * try {
   *   await processJob();
   * } finally {
   *   await locks.release("process-job-123", lock);
   * }
   * ```
   */
  async acquire(key: string, options: LockOptions = {}): Promise<string | null> {
    const {
      timeout = 30,
      retries = 0,
      retryDelay = 100
    } = options;

    const lockToken = this.generateToken();
    let attempts = 0;

    while (attempts <= retries) {
      // Try to acquire lock with NX (only if not exists) and EX (expiration)
      const result = await this.redis.set(
        key,
        lockToken,
        { NX: true, EX: timeout }
      );

      if (result === "OK") {
        return lockToken;
      }

      // If we have retries left, wait and try again
      if (attempts < retries) {
        await this.sleep(retryDelay);
      }

      attempts++;
    }

    return null;
  }

  /**
   * Release a lock
   * 
   * Best Practice: Always release locks in a finally block
   * Safety: Only the lock holder can release (verified by token)
   * 
   * @param key - Lock identifier
   * @param token - Lock token from acquire()
   * @returns True if released, false if token doesn't match
   * 
   * @example
   * ```typescript
   * const lock = await locks.acquire("critical-section");
   * if (lock) {
   *   try {
   *     // Do work
   *   } finally {
   *     await locks.release("critical-section", lock);
   *   }
   * }
   * ```
   */
  async release(key: string, token: string): Promise<boolean> {
    // Verify the token matches before deleting
    const currentToken = await this.redis.get(key);
    
    if (currentToken === token) {
      await this.redis.del(key);
      return true;
    }

    return false;
  }

  /**
   * Extend a lock's expiration
   * 
   * Use when operation takes longer than expected
   * 
   * @param key - Lock identifier
   * @param token - Lock token
   * @param additionalSeconds - Seconds to add to expiration
   * @returns True if extended, false if token doesn't match
   * 
   * @example
   * ```typescript
   * // Extend lock by 30 seconds
   * await locks.extend("long-process", lockToken, 30);
   * ```
   */
  async extend(key: string, token: string, additionalSeconds: number): Promise<boolean> {
    const currentToken = await this.redis.get(key);
    
    if (currentToken === token) {
      await this.redis.command("EXPIRE", key, additionalSeconds);
      return true;
    }

    return false;
  }

  /**
   * Check if a lock is currently held
   * 
   * @param key - Lock identifier
   * @returns True if locked, false if available
   * 
   * @example
   * ```typescript
   * if (await locks.isLocked("resource-x")) {
   *   console.log("Resource is currently locked");
   * }
   * ```
   */
  async isLocked(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return Number(exists) > 0;
  }

  /**
   * Get remaining time on a lock
   * 
   * @param key - Lock identifier
   * @returns Seconds remaining, or -1 if lock doesn't exist
   * 
   * @example
   * ```typescript
   * const ttl = await locks.getTTL("my-lock");
   * console.log(`Lock expires in ${ttl} seconds`);
   * ```
   */
  async getTTL(key: string): Promise<number> {
    return await this.redis.command("TTL", key) as number;
  }

  /**
   * Execute a function with automatic lock management
   * 
   * Best Practice: Easiest and safest way to use locks
   * Handles acquisition, release, and errors automatically
   * 
   * @param key - Lock identifier
   * @param fn - Function to execute while holding lock
   * @param options - Lock configuration
   * @returns Result of fn() or null if lock couldn't be acquired
   * 
   * @example
   * ```typescript
   * // Automatic lock management
   * const result = await locks.withLock("payment:order123", async () => {
   *   await processPayment(order);
   *   return { success: true };
   * }, { timeout: 30, retries: 3 });
   * 
   * if (!result) {
   *   console.log("Could not acquire lock");
   * }
   * ```
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T | null> {
    const token = await this.acquire(key, options);
    
    if (!token) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }

  /**
   * Force release a lock (dangerous!)
   * 
   * WARNING: Only use in emergency situations
   * This can cause race conditions if another process holds the lock
   * 
   * @param key - Lock identifier
   * 
   * @example
   * ```typescript
   * // Emergency unlock (use with caution!)
   * await locks.forceRelease("stuck-lock");
   * ```
   */
  async forceRelease(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Generate a unique lock token
   */
  private generateToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Sleep helper for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
