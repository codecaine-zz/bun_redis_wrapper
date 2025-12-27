/**
 * QueueController
 * 
 * Production-ready job queue with priorities, retries, and scheduling.
 * Perfect for background tasks like email sending, image processing, etc.
 * 
 * @example
 * ```typescript
 * import { QueueController } from "./controllers/QueueController.ts";
 * 
 * const queue = new QueueController(redis);
 * 
 * // Add job
 * await queue.add("send-email", { to: "user@example.com" }, { priority: 5 });
 * 
 * // Process job
 * const job = await queue.next();
 * if (job) {
 *   await sendEmail(job.data);
 *   await queue.complete(job.id);
 * }
 * ```
 */

import type { RedisWrapper } from "../redis-wrapper.ts";
import { createNamespacedRedis } from "../index";

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  createdAt: number;
  attempts: number;
  maxRetries: number;
  lastError?: string;
  scheduledFor?: number;
}

export interface JobOptions {
  /** Priority (1-10, higher = more important) */
  priority?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Delay in seconds before processing */
  delay?: number;
  /** Schedule for specific time */
  scheduledFor?: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export class QueueController {
  private redis: any;

  constructor(redis: RedisWrapper) {
    this.redis = createNamespacedRedis(redis, "queue");
  }

  /**
   * Add a job to the queue
   * 
   * @param type - Job type identifier
   * @param data - Job data
   * @param options - Job options
   * @returns Job ID
   */
  async add<T = any>(
    type: string,
    data: T,
    options: JobOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    const now = Date.now();

    const job: Job<T> = {
      id: jobId,
      type,
      data,
      priority: options.priority || 5,
      createdAt: now,
      attempts: 0,
      maxRetries: options.maxRetries ?? 3,
      scheduledFor: options.scheduledFor?.getTime() || (options.delay ? now + (options.delay * 1000) : now)
    };

    // Store job data
    await this.redis.setJSON(`job:${jobId}`, job);

    // Add to pending queue with priority
    const score = job.scheduledFor! + (10 - job.priority); // Higher priority = lower score
    await this.redis.zadd("pending", [score, jobId]);

    return jobId;
  }

  /**
   * Get next available job (highest priority, not scheduled for future)
   * 
   * @returns Next job or null
   */
  async next<T = any>(): Promise<Job<T> | null> {
    const now = Date.now();

    // Get jobs that are ready to process (score <= now)
    const results = await this.redis.command("ZRANGEBYSCORE", "pending", 0, now, "LIMIT", 0, 1) as string[];

    if (!results || results.length === 0) {
      return null;
    }

    const jobId = results[0];

    // Move to processing
    await this.redis.zrem("pending", jobId);
    await this.redis.zadd("processing", [now, jobId]);

    // Get job data
    const job = await this.redis.getJSON(`job:${jobId}`) as Job<T> | null;

    if (!job) {
      // Job data missing, remove from processing
      await this.redis.zrem("processing", jobId);
      return null;
    }

    return job;
  }

  /**
   * Mark job as completed
   * 
   * @param jobId - Job identifier
   */
  async complete(jobId: string): Promise<void> {
    await this.redis.zrem("processing", jobId);
    await this.redis.command("SADD", "completed", jobId);

    // Keep job data for history (with TTL)
    const job = await this.redis.getJSON(`job:${jobId}`);
    if (job) {
      await this.redis.setJSON(`job:${jobId}`, job, { EX: 86400 }); // 24 hours
    }
  }

  /**
   * Mark job as failed (with retry logic)
   * 
   * @param jobId - Job identifier
   * @param error - Error message
   */
  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.redis.getJSON(`job:${jobId}`) as Job | null;

    if (!job) {
      return;
    }

    job.attempts++;
    job.lastError = error;

    await this.redis.zrem("processing", jobId);

    // Retry if attempts < maxRetries
    if (job.attempts < job.maxRetries) {
      // Exponential backoff: 2^attempts seconds
      const delay = Math.pow(2, job.attempts);
      const retryAt = Date.now() + (delay * 1000);

      await this.redis.setJSON(`job:${jobId}`, job);
      await this.redis.zadd("pending", [retryAt, jobId]);
    } else {
      // Max retries reached
      await this.redis.command("SADD", "failed", jobId);
      await this.redis.setJSON(`job:${jobId}`, job, { EX: 86400 }); // Keep for 24h
    }
  }

  /**
   * Get job details
   * 
   * @param jobId - Job identifier
   * @returns Job data or null
   */
  async getJob<T = any>(jobId: string): Promise<Job<T> | null> {
    return await this.redis.getJSON(`job:${jobId}`) as Job<T> | null;
  }

  /**
   * Get job status
   * 
   * @param jobId - Job identifier
   * @returns Status: "pending", "processing", "completed", "failed", or "unknown"
   */
  async getStatus(jobId: string): Promise<"pending" | "processing" | "completed" | "failed" | "unknown"> {
    const isPending = await this.redis.command("ZSCORE", "pending", jobId);
    if (isPending !== null) return "pending";

    const isProcessing = await this.redis.command("ZSCORE", "processing", jobId);
    if (isProcessing !== null) return "processing";

    const isCompleted = await this.redis.command("SISMEMBER", "completed", jobId);
    if (isCompleted === 1) return "completed";

    const isFailed = await this.redis.command("SISMEMBER", "failed", jobId);
    if (isFailed === 1) return "failed";

    return "unknown";
  }

  /**
   * Get queue statistics
   * 
   * @returns Queue stats
   */
  async getStats(): Promise<QueueStats> {
    const pending = await this.redis.zcard("pending");
    const processing = await this.redis.zcard("processing");
    const completed = await this.redis.command("SCARD", "completed");
    const failed = await this.redis.command("SCARD", "failed");

    return {
      pending,
      processing,
      completed,
      failed
    };
  }

  /**
   * Get pending jobs count by type
   * 
   * @returns Map of job type to count
   */
  async getJobCountByType(): Promise<Record<string, number>> {
    const pending = await this.redis.command("ZRANGE", "pending", 0, -1);
    const counts: Record<string, number> = {};

    for (const jobId of pending) {
      const job = await this.getJob(jobId);
      if (job) {
        counts[job.type] = (counts[job.type] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Cancel a pending job
   * 
   * @param jobId - Job identifier
   * @returns True if cancelled
   */
  async cancel(jobId: string): Promise<boolean> {
    const removed = await this.redis.zrem("pending", jobId);
    if (removed > 0) {
      await this.redis.del(`job:${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Retry a failed job
   * 
   * @param jobId - Job identifier
   * @returns True if retried
   */
  async retry(jobId: string): Promise<boolean> {
    const isFailed = await this.redis.command("SISMEMBER", "failed", jobId);

    if (isFailed !== 1) {
      return false;
    }

    const job = await this.getJob(jobId);

    if (!job) {
      return false;
    }

    // Reset attempts
    job.attempts = 0;
    job.lastError = undefined;

    await this.redis.setJSON(`job:${jobId}`, job);
    await this.redis.command("SREM", "failed", jobId);
    await this.redis.zadd("pending", [Date.now(), jobId]);

    return true;
  }

  /**
   * Clean up completed and failed jobs
   * 
   * @param olderThanHours - Remove jobs older than X hours (default: 24)
   * @returns Number of jobs cleaned
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    const cutoff = Date.now() - (olderThanHours * 3600 * 1000);
    let cleaned = 0;

    // Clean completed
    const completed = await this.redis.command("SMEMBERS", "completed");
    for (const jobId of completed) {
      const job = await this.getJob(jobId);
      if (job && job.createdAt < cutoff) {
        await this.redis.command("SREM", "completed", jobId);
        await this.redis.del(`job:${jobId}`);
        cleaned++;
      }
    }

    // Clean failed
    const failed = await this.redis.command("SMEMBERS", "failed");
    for (const jobId of failed) {
      const job = await this.getJob(jobId);
      if (job && job.createdAt < cutoff) {
        await this.redis.command("SREM", "failed", jobId);
        await this.redis.del(`job:${jobId}`);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all jobs (use with caution!)
   */
  async clear(): Promise<void> {
    await this.redis.del("pending", "processing", "completed", "failed");

    // Delete all job data
    const pattern = "job:*";
    const keys = await this.redis.command("KEYS", pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
