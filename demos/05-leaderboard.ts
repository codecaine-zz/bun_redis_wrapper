/**
 * Demo 5: Leaderboard System (Sorted Sets)
 * 
 * Demonstrates how to build a complete leaderboard system using Redis Sorted Sets:
 * - Player scoring and ranking
 * - Top players retrieval
 * - Score updates and increments
 * - Rank lookup
 * - Multiple leaderboards (daily, weekly, all-time)
 * 
 * Run with: bun run demos/05-leaderboard.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Player {
  id: string;
  name: string;
  score: number;
  rank: number;
}

interface LeaderboardEntry {
  player: string;
  score: number;
  rank: number;
}

// ============================================================================
// Leaderboard Manager Class
// ============================================================================

class LeaderboardManager {
  private board;

  constructor(redis: any) {
    this.board = createNamespacedRedis(redis, "leaderboard");
  }

  /**
   * Add or update a player's score
   */
  async setScore(boardName: string, playerId: string, score: number): Promise<void> {
    await this.board.zadd(boardName, [score, playerId]);
    console.log(`  📊 Set ${playerId} score to ${score} on ${boardName}`);
  }

  /**
   * Increment a player's score
   */
  async incrementScore(
    boardName: string,
    playerId: string,
    points: number
  ): Promise<number> {
    const newScore = await this.board.zincrby(boardName, points, playerId);
    console.log(`  ⬆️  ${playerId} gained ${points} points (total: ${newScore})`);
    return Number(newScore);
  }

  /**
   * Get player's current score
   */
  async getScore(boardName: string, playerId: string): Promise<number | null> {
    const score = await this.board.zscore(boardName, playerId);
    return score ? Number(score) : null;
  }

  /**
   * Get player's rank (1-indexed, higher score = better rank)
   */
  async getRank(boardName: string, playerId: string): Promise<number | null> {
    // ZREVRANK gives rank with highest score as 0
    const rank = await this.board.command<number | null>("ZREVRANK", boardName, playerId);
    return rank !== null ? rank + 1 : null; // Convert to 1-indexed
  }

  /**
   * Get top N players
   */
  async getTopPlayers(boardName: string, count: number = 10): Promise<LeaderboardEntry[]> {
    // Get top players in descending order (highest scores first)
    const results = await this.board.command<any>("ZREVRANGE", boardName, 0, count - 1, "WITHSCORES");
    
    const entries: LeaderboardEntry[] = [];
    
    // Handle nested array format [[member, score], ...]
    if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
      results.forEach((pair: any, index: number) => {
        entries.push({
          player: String(pair[0]),
          score: parseFloat(String(pair[1])),
          rank: index + 1
        });
      });
    } 
    // Handle flat array format [member, score, member, score, ...]
    else if (Array.isArray(results)) {
      for (let i = 0; i < results.length; i += 2) {
        if (i + 1 < results.length) {
          entries.push({
            player: String(results[i]),
            score: parseFloat(String(results[i + 1])),
            rank: Math.floor(i / 2) + 1
          });
        }
      }
    }

    return entries;
  }

  /**
   * Get players around a specific player (for context)
   */
  async getPlayersAround(
    boardName: string,
    playerId: string,
    range: number = 2
  ): Promise<LeaderboardEntry[]> {
    const rank = await this.board.command<number | null>("ZREVRANK", boardName, playerId);
    
    if (rank === null) return [];

    const start = Math.max(0, rank - range);
    const end = rank + range;

    const results = await this.board.command<any>("ZREVRANGE", boardName, start, end, "WITHSCORES");
    const entries: LeaderboardEntry[] = [];

    // Handle nested array format [[member, score], ...]
    if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
      results.forEach((pair: any, index: number) => {
        entries.push({
          player: String(pair[0]),
          score: parseFloat(String(pair[1])),
          rank: start + index + 1
        });
      });
    }
    // Handle flat array format [member, score, member, score, ...]
    else if (Array.isArray(results)) {
      for (let i = 0; i < results.length; i += 2) {
        if (i + 1 < results.length) {
          entries.push({
            player: String(results[i]),
            score: parseFloat(String(results[i + 1])),
            rank: start + Math.floor(i / 2) + 1
          });
        }
      }
    }

    return entries;
  }

  /**
   * Get players by score range
   */
  async getPlayersByScoreRange(
    boardName: string,
    minScore: number,
    maxScore: number
  ): Promise<LeaderboardEntry[]> {
    const players = await this.board.zrangebyscore(boardName, minScore, maxScore);
    const entries: LeaderboardEntry[] = [];

    for (const player of players) {
      const score = await this.getScore(boardName, player);
      const rank = await this.getRank(boardName, player);
      
      if (score !== null && rank !== null) {
        entries.push({ player, score, rank });
      }
    }

    return entries;
  }

  /**
   * Get total number of players
   */
  async getTotalPlayers(boardName: string): Promise<number> {
    return await this.board.zcard(boardName);
  }

  /**
   * Remove a player from leaderboard
   */
  async removePlayer(boardName: string, playerId: string): Promise<void> {
    await this.board.zrem(boardName, playerId);
    console.log(`  🗑️  Removed ${playerId} from ${boardName}`);
  }

  /**
   * Clear entire leaderboard
   */
  async clearLeaderboard(boardName: string): Promise<void> {
    await this.board.del(boardName);
    console.log(`  🧹 Cleared ${boardName}`);
  }

  /**
   * Get player's detailed info
   */
  async getPlayerInfo(boardName: string, playerId: string): Promise<Player | null> {
    const score = await this.getScore(boardName, playerId);
    const rank = await this.getRank(boardName, playerId);

    if (score === null || rank === null) return null;

    return {
      id: playerId,
      name: playerId.replace("player:", ""),
      score,
      rank
    };
  }

  /**
   * Merge multiple leaderboards (for all-time stats)
   */
  async mergeLeaderboards(
    destBoard: string,
    sourceBoards: string[]
  ): Promise<void> {
    // Note: Redis ZUNIONSTORE is more efficient but requires raw command
    // For this demo, we'll manually merge
    
    for (const sourceBoard of sourceBoards) {
      const players = await this.board.zrange(sourceBoard, 0, -1, true);
      
      // Handle nested array format [[member, score], ...]
      if (Array.isArray(players) && players.length > 0 && Array.isArray(players[0])) {
        for (const pair of players) {
          const player = String(pair[0]);
          const score = Number(pair[1]);
          await this.incrementScore(destBoard, player, score);
        }
      }
      // Handle flat array format [member, score, member, score, ...]
      else if (Array.isArray(players)) {
        for (let i = 0; i < players.length; i += 2) {
          if (i + 1 < players.length) {
            const player = String(players[i]);
            const score = Number(players[i + 1]);
            await this.incrementScore(destBoard, player, score);
          }
        }
      }
    }
    
    console.log(`  🔀 Merged ${sourceBoards.length} boards into ${destBoard}`);
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function displayLeaderboard(
  entries: LeaderboardEntry[],
  title: string
): Promise<void> {
  console.log(`\n${title}`);
  console.log("─".repeat(50));
  console.log("Rank | Player           | Score");
  console.log("─".repeat(50));
  
  entries.forEach(entry => {
    const rankStr = `#${entry.rank}`.padEnd(5);
    const playerStr = entry.player.padEnd(16);
    console.log(`${rankStr}| ${playerStr} | ${entry.score.toLocaleString()}`);
  });
}

async function main() {
  console.log("🏆 Demo 5: Leaderboard System (Sorted Sets)\n");

  await using redis = await createRedis("redis://localhost:6379");
  const leaderboard = new LeaderboardManager(redis);

  // ============================================================================
  // Setup: Add Initial Scores
  // ============================================================================
  console.log("🎮 Setting up game leaderboard...\n");

  const players = [
    { id: "player:alice", score: 1500 },
    { id: "player:bob", score: 2300 },
    { id: "player:charlie", score: 1800 },
    { id: "player:diana", score: 3200 },
    { id: "player:eve", score: 2100 },
    { id: "player:frank", score: 1200 },
    { id: "player:grace", score: 2800 },
    { id: "player:henry", score: 950 },
    { id: "player:iris", score: 2600 },
    { id: "player:jack", score: 1700 }
  ];

  for (const player of players) {
    await leaderboard.setScore("daily", player.id, player.score);
  }

  // ============================================================================
  // Feature 1: View Top Players
  // ============================================================================
  console.log("\n📊 Top 5 Players");
  const top5 = await leaderboard.getTopPlayers("daily", 5);
  await displayLeaderboard(top5, "🏆 DAILY LEADERBOARD - TOP 5");

  // ============================================================================
  // Feature 2: Get Player Rank and Score
  // ============================================================================
  console.log("\n\n🔍 Player Lookup");
  console.log("─────────────────────────────────────────");

  const bobInfo = await leaderboard.getPlayerInfo("daily", "player:bob");
  if (bobInfo) {
    console.log(`Player: ${bobInfo.name}`);
    console.log(`Score: ${bobInfo.score.toLocaleString()}`);
    console.log(`Rank: #${bobInfo.rank}`);
  }

  // ============================================================================
  // Feature 3: Increment Score (Game Victory)
  // ============================================================================
  console.log("\n\n⚔️  Player actions...\n");

  await leaderboard.incrementScore("daily", "player:alice", 500);
  await leaderboard.incrementScore("daily", "player:bob", 300);
  await leaderboard.incrementScore("daily", "player:alice", 200);

  // ============================================================================
  // Feature 4: View Updated Rankings
  // ============================================================================
  console.log("\n📊 Updated Top 5 After Gameplay");
  const updatedTop5 = await leaderboard.getTopPlayers("daily", 5);
  await displayLeaderboard(updatedTop5, "🏆 DAILY LEADERBOARD - UPDATED");

  // ============================================================================
  // Feature 5: Players Around a Specific Player
  // ============================================================================
  console.log("\n\n👥 Players Around Bob (±2 ranks)");
  const aroundBob = await leaderboard.getPlayersAround("daily", "player:bob", 2);
  await displayLeaderboard(aroundBob, "Contextual View");

  // ============================================================================
  // Feature 6: Score Range Queries
  // ============================================================================
  console.log("\n\n📈 Players with 2000-3000 points");
  console.log("─────────────────────────────────────────");
  
  const midRange = await leaderboard.getPlayersByScoreRange("daily", 2000, 3000);
  console.log(`Found ${midRange.length} players in this range:`);
  midRange.forEach(p => {
    console.log(`  ${p.player}: ${p.score} points (Rank #${p.rank})`);
  });

  // ============================================================================
  // Feature 7: Statistics
  // ============================================================================
  console.log("\n\n📊 Leaderboard Statistics");
  console.log("─────────────────────────────────────────");

  const totalPlayers = await leaderboard.getTotalPlayers("daily");
  console.log(`Total Players: ${totalPlayers}`);

  const top1 = await leaderboard.getTopPlayers("daily", 1);
  if (top1.length > 0 && top1[0]) {
    console.log(`Highest Score: ${top1[0].score} (${top1[0].player})`);
  }

  // ============================================================================
  // Feature 8: Multiple Leaderboards (Weekly, All-Time)
  // ============================================================================
  console.log("\n\n📅 Multiple Leaderboards");
  console.log("─────────────────────────────────────────");

  // Simulate weekly scores
  console.log("\nSetting up weekly leaderboard...");
  await leaderboard.setScore("weekly", "player:alice", 8500);
  await leaderboard.setScore("weekly", "player:diana", 9200);
  await leaderboard.setScore("weekly", "player:grace", 7800);

  const weeklyTop = await leaderboard.getTopPlayers("weekly", 3);
  await displayLeaderboard(weeklyTop, "📅 WEEKLY LEADERBOARD");

  // ============================================================================
  // Feature 9: Merge Leaderboards (All-Time)
  // ============================================================================
  console.log("\n\n🔀 Merging daily + weekly → all-time");
  console.log("─────────────────────────────────────────");

  await leaderboard.mergeLeaderboards("alltime", ["daily", "weekly"]);
  
  const alltimeTop = await leaderboard.getTopPlayers("alltime", 5);
  await displayLeaderboard(alltimeTop, "🏅 ALL-TIME LEADERBOARD");

  // ============================================================================
  // Feature 10: Real-World Use Case - Tournament Brackets
  // ============================================================================
  console.log("\n\n🎯 Tournament Bracket Example");
  console.log("─────────────────────────────────────────");

  // Simulate tournament rounds
  await leaderboard.setScore("tournament:round1", "team:alpha", 45);
  await leaderboard.setScore("tournament:round1", "team:beta", 52);
  await leaderboard.setScore("tournament:round1", "team:gamma", 38);
  await leaderboard.setScore("tournament:round1", "team:delta", 48);

  const tournamentStandings = await leaderboard.getTopPlayers("tournament:round1", 4);
  console.log("\nRound 1 Standings:");
  tournamentStandings.forEach(t => {
    console.log(`  #${t.rank} ${t.player}: ${t.score} points`);
  });

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use ZADD for adding/updating scores");
  console.log("  ✓ Use ZINCRBY for score increments");
  console.log("  ✓ Use ZREVRANGE for top-N queries (highest first)");
  console.log("  ✓ Use ZREVRANK to get player rank");
  console.log("  ✓ Use ZRANGEBYSCORE for score range queries");
  console.log("  ✓ Create separate boards for daily/weekly/monthly");
  console.log("  ✓ Use TTL to auto-expire temporary leaderboards");
  console.log("  ✓ Consider pagination for large leaderboards");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  await leaderboard.clearLeaderboard("daily");
  await leaderboard.clearLeaderboard("weekly");
  await leaderboard.clearLeaderboard("alltime");
  await leaderboard.clearLeaderboard("tournament:round1");

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
