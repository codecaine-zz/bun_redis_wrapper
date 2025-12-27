/**
 * Demo 2: Session Management
 * 
 * Demonstrates how to build a complete session management system
 * with user authentication, session storage, and automatic expiration.
 * 
 * Run with: bun run demos/02-session-management.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface UserSession {
  sessionId: string;
  userId: string;
  username: string;
  email: string;
  loginAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

interface SessionStats {
  totalActiveSessions: number;
  userSessions: number;
  averageSessionAge: number;
}

// ============================================================================
// Session Manager Class
// ============================================================================

class SessionManager {
  private sessions;

  constructor(redis: any) {
    // Use namespace for session isolation
    this.sessions = createNamespacedRedis(redis, "sessions");
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string,
    username: string,
    email: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: UserSession = {
      sessionId,
      userId,
      username,
      email,
      loginAt: now,
      lastActivity: now,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };

    // Store session with 1 hour TTL
    const SESSION_TTL = 3600; // 1 hour in seconds
    await this.sessions.setJSON(`session:${sessionId}`, session, { EX: SESSION_TTL });

    // Track user's active sessions (for multi-device support)
    await this.sessions.sadd(`user:${userId}:sessions`, sessionId);

    console.log(`✅ Created session ${sessionId} for user ${username}`);
    return sessionId;
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.sessions.getJSON<UserSession>(`session:${sessionId}`);
    
    if (session) {
      // Update last activity time
      session.lastActivity = Date.now();
      await this.sessions.setJSON(`session:${sessionId}`, session, { EX: 3600 });
    }

    return session;
  }

  /**
   * Validate session and check if expired
   */
  async validateSession(sessionId: string): Promise<boolean> {
    return await this.sessions.exists(`session:${sessionId}`);
  }

  /**
   * Destroy a session (logout)
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.sessions.getJSON<UserSession>(`session:${sessionId}`);
    
    if (session) {
      // Remove from user's active sessions
      await this.sessions.srem(`user:${session.userId}:sessions`, sessionId);
      
      // Delete session data
      await this.sessions.del(`session:${sessionId}`);
      
      console.log(`🗑️  Destroyed session ${sessionId}`);
    }
  }

  /**
   * Destroy all sessions for a user (logout from all devices)
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.sessions.smembers(`user:${userId}:sessions`);
    
    if (sessionIds.length > 0) {
      // Delete all session data
      const sessionKeys = sessionIds.map(id => `session:${id}`);
      await this.sessions.del(...sessionKeys);
      
      // Clear the set
      await this.sessions.del(`user:${userId}:sessions`);
      
      console.log(`🗑️  Destroyed ${sessionIds.length} sessions for user ${userId}`);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessionIds = await this.sessions.smembers(`user:${userId}:sessions`);
    const sessions: UserSession[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.sessions.getJSON<UserSession>(`session:${sessionId}`);
      if (session) {
        sessions.push(session);
      } else {
        // Clean up expired session reference
        await this.sessions.srem(`user:${userId}:sessions`, sessionId);
      }
    }

    return sessions;
  }

  /**
   * Extend session TTL (keep-alive)
   */
  async extendSession(sessionId: string, seconds: number = 3600): Promise<boolean> {
    const exists = await this.sessions.exists(`session:${sessionId}`);
    if (exists) {
      await this.sessions.setTTL(`session:${sessionId}`, seconds);
      return true;
    }
    return false;
  }

  /**
   * Get session statistics
   */
  async getStats(userId?: string): Promise<SessionStats> {
    if (userId) {
      const sessions = await this.getUserSessions(userId);
      const now = Date.now();
      const avgAge = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (now - s.loginAt), 0) / sessions.length
        : 0;

      return {
        totalActiveSessions: sessions.length,
        userSessions: sessions.length,
        averageSessionAge: Math.floor(avgAge / 1000) // in seconds
      };
    }

    // Get all sessions (admin view)
    const allSessionKeys = await this.sessions.scanAll("session:*");
    return {
      totalActiveSessions: allSessionKeys.length,
      userSessions: 0,
      averageSessionAge: 0
    };
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function main() {
  console.log("🔐 Demo 2: Session Management\n");

  await using redis = await createRedis("redis://localhost:6379");
  const sessionManager = new SessionManager(redis);

  // ============================================================================
  // Create Sessions
  // ============================================================================
  console.log("📝 Creating user sessions...\n");

  const session1 = await sessionManager.createSession(
    "user-123",
    "alice",
    "alice@example.com",
    { ipAddress: "192.168.1.100", userAgent: "Mozilla/5.0 (Desktop)" }
  );

  const session2 = await sessionManager.createSession(
    "user-123",
    "alice",
    "alice@example.com",
    { ipAddress: "10.0.0.50", userAgent: "Mozilla/5.0 (Mobile)" }
  );

  const session3 = await sessionManager.createSession(
    "user-456",
    "bob",
    "bob@example.com",
    { ipAddress: "192.168.1.101", userAgent: "Chrome/90.0" }
  );

  // ============================================================================
  // Retrieve Session
  // ============================================================================
  console.log("\n🔍 Retrieving session data...\n");

  const session = await sessionManager.getSession(session1);
  if (session) {
    console.log("Session Details:");
    console.log(`  User: ${session.username} (${session.email})`);
    console.log(`  Login: ${new Date(session.loginAt).toLocaleString()}`);
    console.log(`  IP: ${session.ipAddress}`);
    console.log(`  Device: ${session.userAgent}`);
  }

  // ============================================================================
  // Validate Session
  // ============================================================================
  console.log("\n✅ Validating sessions...\n");

  const isValid = await sessionManager.validateSession(session1);
  console.log(`Session ${session1.slice(0, 8)}... is ${isValid ? "VALID" : "INVALID"}`);

  const isInvalid = await sessionManager.validateSession("fake-session-id");
  console.log(`Session fake-session-id is ${isInvalid ? "VALID" : "INVALID"}`);

  // ============================================================================
  // Multi-Device Sessions
  // ============================================================================
  console.log("\n📱 Multi-device session management...\n");

  const aliceSessions = await sessionManager.getUserSessions("user-123");
  console.log(`Alice has ${aliceSessions.length} active sessions:`);
  aliceSessions.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.sessionId.slice(0, 8)}... - ${s.ipAddress} (${s.userAgent})`);
  });

  // ============================================================================
  // Session Statistics
  // ============================================================================
  console.log("\n📊 Session statistics...\n");

  const aliceStats = await sessionManager.getStats("user-123");
  console.log("Alice's Stats:");
  console.log(`  Active sessions: ${aliceStats.userSessions}`);
  console.log(`  Avg session age: ${aliceStats.averageSessionAge}s`);

  const globalStats = await sessionManager.getStats();
  console.log("\nGlobal Stats:");
  console.log(`  Total active sessions: ${globalStats.totalActiveSessions}`);

  // ============================================================================
  // Extend Session
  // ============================================================================
  console.log("\n⏰ Extending session TTL...\n");

  const extended = await sessionManager.extendSession(session1, 7200); // 2 hours
  console.log(`Session ${session1.slice(0, 8)}... extended: ${extended}`);

  // ============================================================================
  // Logout from Single Device
  // ============================================================================
  console.log("\n🚪 Logout from single device...\n");

  await sessionManager.destroySession(session2);
  const remainingSessions = await sessionManager.getUserSessions("user-123");
  console.log(`Alice now has ${remainingSessions.length} active session(s)`);

  // ============================================================================
  // Logout from All Devices
  // ============================================================================
  console.log("\n🚪 Logout from all devices...\n");

  await sessionManager.destroyAllUserSessions("user-123");
  const noSessions = await sessionManager.getUserSessions("user-123");
  console.log(`Alice now has ${noSessions.length} active session(s)`);

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  await sessionManager.destroyAllUserSessions("user-456");

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
