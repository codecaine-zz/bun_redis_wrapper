/**
 * LeaderboardController
 * 
 * High-performance leaderboards and rankings using Redis Sorted Sets.
 * Perfect for gaming, competitions, and any ranking system.
 * 
 * Perfect for: Games, competitions, top performers, trending content
 * 
 * @example
 * ```typescript
 * import { LeaderboardController } from "./controllers/LeaderboardController";
 * 
 * const leaderboard = new LeaderboardController(redis);
 * 
 * // Add player scores
 * await leaderboard.addScore("game1", "player123", 1500);
 * 
 * // Get top 10
 * const top10 = await leaderboard.getTop("game1", 10);
 * 
 * // Get player rank
 * const rank = await leaderboard.getRank("game1", "player123");
 * ```
 */

import type { NamespacedRedisWrapper } from "../index";
import { RedisWrapper, createNamespacedRedis } from "../index";

export interface LeaderboardEntry {
  member: string;
  score: number;
  rank: number;
}

export interface LeaderboardStats {
  totalPlayers: number;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
}

/**
 * LeaderboardController for rankings and scores
 * 
 * Lightning-fast rankings using Redis Sorted Sets.
 * Handles millions of entries efficiently.
 */
export class LeaderboardController {
  private redis: NamespacedRedisWrapper;

  constructor(redis: RedisWrapper | NamespacedRedisWrapper, namespace: string = "leaderboard") {
    this.redis = redis instanceof RedisWrapper
      ? createNamespacedRedis(redis, namespace)
      : redis;
  }

  /**
   * Add or update a score
   * 
   * Best Practice: Higher scores = better rank (use negative for reverse)
   * Tip: Call this after every score change
   * 
   * @param board - Leaderboard name
   * @param member - Player/item identifier
   * @param score - Score value
   * @returns New score
   * 
   * @example
   * ```typescript
   * // Add player score
   * await leaderboard.addScore("daily-challenge", "player123", 1500);
   * 
   * // Multiple boards for different time periods
   * await leaderboard.addScore("daily-2024-12-27", "player123", 1500);
   * await leaderboard.addScore("weekly-2024-W52", "player123", 1500);
   * await leaderboard.addScore("all-time", "player123", 1500);
   * ```
   */
  async addScore(board: string, member: string, score: number): Promise<number> {
    await this.redis.zadd(board, [score, member] as [number, string]);
    return score;
  }

  /**
   * Increment a score (atomic)
   * 
   * Best Practice: Use this for score updates (safer than set)
   * 
   * @param board - Leaderboard name
   * @param member - Player/item identifier
   * @param increment - Amount to add (can be negative)
   * @returns New total score
   * 
   * @example
   * ```typescript
   * // Add 100 points
   * await leaderboard.incrementScore("game1", "player123", 100);
   * 
   * // Subtract points (penalty)
   * await leaderboard.incrementScore("game1", "cheater", -500);
   * ```
   */
  async incrementScore(board: string, member: string, increment: number): Promise<number> {
    const result = await this.redis.zincrby(board, increment, member);
    return parseFloat(result);
  }

  /**
   * Get top N players (highest scores)
   * 
   * @param board - Leaderboard name
   * @param count - Number of entries to return
   * @param withScores - Include scores in results
   * @returns Array of top entries
   * 
   * @example
   * ```typescript
   * // Get top 10 with scores
   * const top10 = await leaderboard.getTop("game1", 10, true);
   * top10.forEach((entry, i) => {
   *   console.log(`#${i + 1}: ${entry.member} - ${entry.score} points`);
   * });
   * ```
   */
  async getTop(board: string, count: number = 10, withScores: boolean = true): Promise<LeaderboardEntry[]> {
    const results = await this.redis.command(
      "ZREVRANGE",
      board,
      0,
      count - 1,
      ...(withScores ? ["WITHSCORES"] : [])
    ) as any;

    if (!withScores) {
      return (results as string[]).map((member, i) => ({
        member,
        score: 0,
        rank: i + 1
      }));
    }

    // Handle both flat array [member, score, member, score] and nested [[member, score], [member, score]]
    const entries: LeaderboardEntry[] = [];
    
    // Check if results are nested arrays
    if (results.length > 0 && Array.isArray(results[0])) {
      // Nested format: [[member, score], ...]
      results.forEach((pair: any, index: number) => {
        entries.push({
          member: String(pair[0] || ""),
          score: parseFloat(String(pair[1] || "0")),
          rank: index + 1
        });
      });
    } else {
      // Flat format: [member, score, member, score, ...]
      for (let i = 0; i < results.length; i += 2) {
        entries.push({
          member: String(results[i] || ""),
          score: parseFloat(String(results[i + 1] || "0")),
          rank: (i / 2) + 1
        });
      }
    }

    return entries;
  }

  /**
   * Get bottom N players (lowest scores)
   * 
   * @param board - Leaderboard name
   * @param count - Number of entries to return
   * @returns Array of bottom entries
   * 
   * @example
   * ```typescript
   * // Get players who need help
   * const struggling = await leaderboard.getBottom("game1", 10);
   * ```
   */
  async getBottom(board: string, count: number = 10): Promise<LeaderboardEntry[]> {
    const results = await this.redis.command(
      "ZRANGE",
      board,
      0,
      count - 1,
      "WITHSCORES"
    ) as any;

    const entries: LeaderboardEntry[] = [];
    
    // Handle both flat array and nested array formats
    if (results.length > 0 && Array.isArray(results[0])) {
      // Nested format: [[member, score], ...]
      results.forEach((pair: any, index: number) => {
        entries.push({
          member: String(pair[0] || ""),
          score: parseFloat(String(pair[1] || "0")),
          rank: index + 1 // Note: These are NOT global ranks
        });
      });
    } else {
      // Flat format: [member, score, member, score, ...]
      for (let i = 0; i < results.length; i += 2) {
        entries.push({
          member: String(results[i] || ""),
          score: parseFloat(String(results[i + 1] || "0")),
          rank: i + 1 // Note: These are NOT global ranks
        });
      }
    }

    return entries;
  }

  /**
   * Get player's rank (1-based, 1 = highest)
   * 
   * @param board - Leaderboard name
   * @param member - Player/item identifier
   * @returns Rank (1 = best) or null if not found
   * 
   * @example
   * ```typescript
   * const rank = await leaderboard.getRank("game1", "player123");
   * if (rank) {
   *   console.log(`You are rank #${rank}!`);
   * }
   * ```
   */
  async getRank(board: string, member: string): Promise<number | null> {
    const rank = await this.redis.command("ZREVRANK", board, member) as number | null;
    return rank !== null ? rank + 1 : null;
  }

  /**
   * Get player's score
   * 
   * @param board - Leaderboard name
   * @param member - Player/item identifier
   * @returns Score or null if not found
   * 
   * @example
   * ```typescript
   * const score = await leaderboard.getScore("game1", "player123");
   * console.log(`Your score: ${score}`);
   * ```
   */
  async getScore(board: string, member: string): Promise<number | null> {
    const score = await this.redis.zscore(board, member);
    return score !== null ? parseFloat(String(score)) : null;
  }

  /**
   * Get player's rank and score together
   * 
   * More efficient than calling both separately
   * 
   * @param board - Leaderboard name
   * @param member - Player/item identifier
   * @returns Entry with rank and score, or null
   * 
   * @example
   * ```typescript
   * const info = await leaderboard.getMemberInfo("game1", "player123");
   * if (info) {
   *   console.log(`Rank: #${info.rank}, Score: ${info.score}`);
   * }
   * ```
   */
  async getMemberInfo(board: string, member: string): Promise<LeaderboardEntry | null> {
    const [rank, score] = await Promise.all([
      this.getRank(board, member),
      this.getScore(board, member)
    ]);

    if (rank === null || score === null) {
      return null;
    }

    return { member, rank, score };
  }

  /**
   * Get players within a score range
   * 
   * @param board - Leaderboard name
   * @param minScore - Minimum score (inclusive)
   * @param maxScore - Maximum score (inclusive)
   * @returns Array of entries in range
   * 
   * @example
   * ```typescript
   * // Get all players between 1000-2000 points
   * const midTier = await leaderboard.getByScoreRange("game1", 1000, 2000);
   * ```
   */
  async getByScoreRange(board: string, minScore: number, maxScore: number): Promise<LeaderboardEntry[]> {
    const results = await this.redis.command(
      "ZRANGEBYSCORE",
      board,
      minScore,
      maxScore,
      "WITHSCORES"
    ) as any;

    const entries: LeaderboardEntry[] = [];
    
    // Handle both flat array and nested array formats
    if (results.length > 0 && Array.isArray(results[0])) {
      // Nested format: [[member, score], ...]
      for (const pair of results) {
        const member = String(pair[0] || "");
        const score = parseFloat(String(pair[1] || "0"));
        const rank = await this.getRank(board, member);
        
        entries.push({
          member,
          score,
          rank: rank || 0
        });
      }
    } else {
      // Flat format: [member, score, member, score, ...]
      for (let i = 0; i < results.length; i += 2) {
        const member = String(results[i] || "");
        const score = parseFloat(String(results[i + 1] || "0"));
        const rank = await this.getRank(board, member);
        
        entries.push({
          member,
          score,
          rank: rank || 0
        });
      }
    }

    return entries;
  }

  /**
   * Get players around a specific player
   * 
   * Perfect for showing "nearby" competitors
   * 
   * @param board - Leaderboard name
   * @param member - Player to center on
   * @param range - Number of players above and below (default: 5)
   * @returns Array of entries around the player
   * 
   * @example
   * ```typescript
   * // Show player and 5 above/below
   * const nearby = await leaderboard.getAround("game1", "player123", 5);
   * ```
   */
  async getAround(board: string, member: string, range: number = 5): Promise<LeaderboardEntry[]> {
    const rank = await this.getRank(board, member);
    
    if (rank === null) {
      return [];
    }

    const start = Math.max(0, rank - range - 1);
    const end = rank + range - 1;

    const results = await this.redis.command(
      "ZREVRANGE",
      board,
      start,
      end,
      "WITHSCORES"
    ) as any;

    const entries: LeaderboardEntry[] = [];
    
    // Handle both flat array and nested array formats
    if (results.length > 0 && Array.isArray(results[0])) {
      // Nested format: [[member, score], ...]
      results.forEach((pair: any, index: number) => {
        entries.push({
          member: String(pair[0] || ""),
          score: parseFloat(String(pair[1] || "0")),
          rank: start + index + 1
        });
      });
    } else {
      // Flat format: [member, score, member, score, ...]
      for (let i = 0; i < results.length; i += 2) {
        entries.push({
          member: String(results[i] || ""),
          score: parseFloat(String(results[i + 1] || "0")),
          rank: start + (i / 2) + 1
        });
      }
    }

    return entries;
  }

  /**
   * Remove a player from leaderboard
   * 
   * @param board - Leaderboard name
   * @param member - Player to remove
   * @returns True if removed
   * 
   * @example
   * ```typescript
   * await leaderboard.remove("game1", "banned-player");
   * ```
   */
  async remove(board: string, member: string): Promise<boolean> {
    const result = await this.redis.zrem(board, member);
    return result > 0;
  }

  /**
   * Get total player count
   * 
   * @param board - Leaderboard name
   * @returns Number of players
   * 
   * @example
   * ```typescript
   * const total = await leaderboard.getCount("game1");
   * console.log(`${total} players competing`);
   * ```
   */
  async getCount(board: string): Promise<number> {
    return await this.redis.zcard(board);
  }

  /**
   * Get leaderboard statistics
   * 
   * @param board - Leaderboard name
   * @returns Statistics object
   * 
   * @example
   * ```typescript
   * const stats = await leaderboard.getStats("game1");
   * console.log(`Average score: ${stats.averageScore}`);
   * ```
   */
  async getStats(board: string): Promise<LeaderboardStats> {
    const count = await this.getCount(board);
    
    if (count === 0) {
      return {
        totalPlayers: 0,
        highestScore: 0,
        lowestScore: 0,
        averageScore: 0
      };
    }

    const [top, bottom] = await Promise.all([
      this.getTop(board, 1),
      this.getBottom(board, 1)
    ]);

    // Get all scores for average (expensive for large boards)
    const allScores = await this.redis.command(
      "ZRANGE",
      board,
      0,
      -1,
      "WITHSCORES"
    ) as any;
    
    let sum = 0;
    
    // Handle both flat array and nested array formats
    if (allScores.length > 0 && Array.isArray(allScores[0])) {
      // Nested format: [[member, score], ...]
      for (const pair of allScores) {
        sum += parseFloat(String(pair[1] || "0"));
      }
    } else {
      // Flat format: [member, score, member, score, ...]
      for (let i = 1; i < allScores.length; i += 2) {
        sum += parseFloat(String(allScores[i] || "0"));
      }
    }

    return {
      totalPlayers: count,
      highestScore: top[0]?.score || 0,
      lowestScore: bottom[0]?.score || 0,
      averageScore: sum / count
    };
  }

  /**
   * Clear entire leaderboard
   * 
   * WARNING: This deletes all scores permanently
   * 
   * @param board - Leaderboard name
   * 
   * @example
   * ```typescript
   * // Reset for new season
   * await leaderboard.clear("daily-challenge");
   * ```
   */
  async clear(board: string): Promise<void> {
    await this.redis.del(board);
  }
}
