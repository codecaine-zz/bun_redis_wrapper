/**
 * AnalyticsController
 * 
 * Memory-efficient analytics tracking using HyperLogLog for unique counting
 * and counters for event tracking. Perfect for tracking page views, user activity,
 * and other metrics at scale.
 * 
 * @example
 * ```typescript
 * import { AnalyticsController } from "./controllers/AnalyticsController.ts";
 * 
 * const analytics = new AnalyticsController(redis);
 * 
 * // Track unique visitor
 * await analytics.trackUnique("daily-visitors", "user-123");
 * 
 * // Track event
 * await analytics.trackEvent("page-view", "/dashboard", "user-123");
 * 
 * // Get stats
 * const visitors = await analytics.getUniqueCount("daily-visitors");
 * ```
 */

import { RedisWrapper } from "../redis-wrapper";
import { createNamespacedRedis, type NamespacedRedisWrapper } from "../index";

export interface EventStats {
  total: number;
  unique: number;
}

export interface TimeSeriesData {
  date: string;
  count: number;
}

export class AnalyticsController {
  private redis: NamespacedRedisWrapper;

  constructor(redis: RedisWrapper | NamespacedRedisWrapper, namespace: string = "analytics") {
    this.redis = redis instanceof RedisWrapper
      ? createNamespacedRedis(redis, namespace)
      : redis;
  }

  /**
   * Track a unique occurrence (using HyperLogLog)
   * Memory efficient - only ~12KB per metric regardless of cardinality
   * 
   * @param metric - Metric name (e.g., "daily-visitors", "page-views:/dashboard")
   * @param identifier - Unique identifier (user ID, IP, etc.)
   */
  async trackUnique(metric: string, identifier: string): Promise<void> {
    await this.redis.pfadd(`unique:${metric}`, identifier);
  }

  /**
   * Get unique count for a metric
   * 
   * @param metric - Metric name
   * @returns Approximate unique count (±0.81% error)
   */
  async getUniqueCount(metric: string): Promise<number> {
    return await this.redis.pfcount(`unique:${metric}`);
  }

  /**
   * Merge multiple unique metrics
   * Useful for calculating WAU (Weekly Active Users) from daily metrics
   * 
   * @param destMetric - Destination metric name
   * @param sourceMetrics - Source metric names to merge
   */
  async mergeUnique(destMetric: string, ...sourceMetrics: string[]): Promise<void> {
    const sourceKeys = sourceMetrics.map(m => `unique:${m}`);
    await this.redis.pfmerge(`unique:${destMetric}`, ...sourceKeys);
  }

  /**
   * Track an event occurrence
   * 
   * @param eventType - Event type (e.g., "page-view", "button-click")
   * @param eventName - Event name (e.g., "/dashboard", "signup-button")
   * @param userId - Optional user identifier for unique tracking
   */
  async trackEvent(eventType: string, eventName: string, userId?: string): Promise<void> {
    await this.redis.incr(`event:${eventType}:${eventName}`);

    // Also track unique if userId provided
    if (userId) {
      await this.trackUnique(`${eventType}:${eventName}`, userId);
    }
  }

  /**
   * Get event count
   * 
   * @param eventType - Event type
   * @param eventName - Event name
   * @returns Total event count
   */
  async getEventCount(eventType: string, eventName: string): Promise<number> {
    const count = await this.redis.get(`event:${eventType}:${eventName}`);
    return count ? parseInt(count) : 0;
  }

  /**
   * Get event statistics (total and unique)
   * 
   * @param eventType - Event type
   * @param eventName - Event name
   * @returns Event statistics
   */
  async getEventStats(eventType: string, eventName: string): Promise<EventStats> {
    const total = await this.getEventCount(eventType, eventName);
    const unique = await this.getUniqueCount(`${eventType}:${eventName}`);

    return { total, unique };
  }

  /**
   * Track daily active users
   * 
   * @param userId - User identifier
   * @param date - Optional date (defaults to today)
   */
  async trackDAU(userId: string, date?: Date): Promise<void> {
    const dateStr = this.formatDate(date || new Date());
    await this.trackUnique(`dau:${dateStr}`, userId);
  }

  /**
   * Get daily active users count
   * 
   * @param date - Optional date (defaults to today)
   * @returns DAU count
   */
  async getDAU(date?: Date): Promise<number> {
    const dateStr = this.formatDate(date || new Date());
    return await this.getUniqueCount(`dau:${dateStr}`);
  }

  /**
   * Get weekly active users
   * Merges last 7 days of DAU
   * 
   * @param endDate - End date (defaults to today)
   * @returns WAU count
   */
  async getWAU(endDate?: Date): Promise<number> {
    const end = endDate || new Date();
    const metrics: string[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(end);
      date.setDate(date.getDate() - i);
      metrics.push(`dau:${this.formatDate(date)}`);
    }

    const tempKey = `wau:${this.formatDate(end)}`;
    await this.mergeUnique(tempKey, ...metrics);
    const count = await this.getUniqueCount(tempKey);

    // Clean up temporary key
    await this.redis.del(`unique:${tempKey}`);

    return count;
  }

  /**
   * Get monthly active users
   * Merges last 30 days of DAU
   * 
   * @param endDate - End date (defaults to today)
   * @returns MAU count
   */
  async getMAU(endDate?: Date): Promise<number> {
    const end = endDate || new Date();
    const metrics: string[] = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(end);
      date.setDate(date.getDate() - i);
      metrics.push(`dau:${this.formatDate(date)}`);
    }

    const tempKey = `mau:${this.formatDate(end)}`;
    await this.mergeUnique(tempKey, ...metrics);
    const count = await this.getUniqueCount(tempKey);

    // Clean up temporary key
    await this.redis.del(`unique:${tempKey}`);

    return count;
  }

  /**
   * Track time-series data
   * 
   * @param metric - Metric name
   * @param value - Value to add
   * @param timestamp - Optional timestamp (defaults to now)
   */
  async trackTimeSeries(metric: string, value: number, timestamp?: Date): Promise<void> {
    const ts = timestamp || new Date();
    const dateStr = this.formatDate(ts);
    const key = `timeseries:${metric}:${dateStr}`;
    
    if (value === 1) {
      await this.redis.incr(key);
    } else {
      await this.redis.command("INCRBY", key, value);
    }

    // Auto-expire after 90 days
    await this.redis.expire(key, 90 * 86400);
  }

  /**
   * Get time-series data for date range
   * 
   * @param metric - Metric name
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of time-series data points
   */
  async getDateRange(metric: string, startDate: Date, endDate: Date): Promise<TimeSeriesData[]> {
    const data: TimeSeriesData[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = this.formatDate(current);
      const key = `timeseries:${metric}:${dateStr}`;
      const value = await this.redis.get(key);

      data.push({
        date: dateStr,
        count: value ? parseInt(value) : 0
      });

      current.setDate(current.getDate() + 1);
    }

    return data;
  }

  /**
   * Increment a counter
   * 
   * @param counter - Counter name
   * @param amount - Amount to increment (default: 1)
   * @returns New value
   */
  async increment(counter: string, amount: number = 1): Promise<number> {
    const key = `counter:${counter}`;
    if (amount === 1) {
      return await this.redis.incr(key);
    }
    return await this.redis.command<number>("INCRBY", key, amount);
  }

  /**
   * Get counter value
   * 
   * @param counter - Counter name
   * @returns Counter value
   */
  async getCounter(counter: string): Promise<number> {
    const key = `counter:${counter}`;
    const value = await this.redis.get(key);
    return value ? parseInt(value) : 0;
  }

  /**
   * Reset counter
   * 
   * @param counter - Counter name
   */
  async resetCounter(counter: string): Promise<void> {
    const key = `counter:${counter}`;
    await this.redis.del(key);
  }

  /**
   * Track funnel step
   * 
   * @param funnelName - Funnel name
   * @param step - Step name
   * @param userId - User identifier
   */
  async trackFunnelStep(funnelName: string, step: string, userId: string): Promise<void> {
    await this.trackUnique(`funnel:${funnelName}:${step}`, userId);
  }

  /**
   * Get funnel conversion rates
   * 
   * @param funnelName - Funnel name
   * @param steps - Array of step names in order
   * @returns Map of step name to user count and conversion rate
   */
  async getFunnelStats(funnelName: string, steps: string[]): Promise<Array<{
    step: string;
    users: number;
    conversionRate: number;
  }>> {
    const stats: Array<{ step: string; users: number; conversionRate: number }> = [];
    let previousCount = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      const users = await this.getUniqueCount(`funnel:${funnelName}:${step}`);
      const conversionRate = i === 0 ? 100 : (users / previousCount) * 100;

      stats.push({
        step,
        users,
        conversionRate: Math.round(conversionRate * 100) / 100
      });

      previousCount = users;
    }

    return stats;
  }

  /**
   * Clear analytics for a metric
   * 
   * @param metric - Metric name or pattern
   * @returns Number of keys deleted
   */
  async clearMetric(metric: string): Promise<number> {
    const keys = await this.redis.scanAll(`*${metric}*`);

    if (keys.length === 0) {
      return 0;
    }

    return await this.redis.del(...keys);
  }

  /**
   * Get all metrics
   * 
   * @returns Array of metric names
   */
  async listMetrics(): Promise<string[]> {
    const keys = await this.redis.scanAll("*");

    // Extract unique metric names
    const metrics = new Set<string>();

    for (const key of keys) {
      const parts = key.split(":");
      if (parts.length >= 2 && parts[1]) {
        metrics.add(parts[1]);
      }
    }

    return Array.from(metrics);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

}
