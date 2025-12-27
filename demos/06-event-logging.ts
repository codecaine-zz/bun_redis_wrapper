/**
 * Demo 6: Event Logging (Streams)
 * 
 * Demonstrates Redis Streams for event sourcing and logging:
 * - Event logging and tracking
 * - Reading events by time range
 * - Consumer groups for distributed processing
 * - Audit logs and activity tracking
 * 
 * Run with: bun run demos/06-event-logging.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface UserEvent {
  eventType: string;
  userId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

// ============================================================================
// Event Logger Class
// ============================================================================

class EventLogger {
  private events;

  constructor(redis: any) {
    this.events = createNamespacedRedis(redis, "events");
  }

  /**
   * Log an event to a stream
   */
  async logEvent(
    streamName: string,
    eventType: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const eventData = {
      eventType,
      userId,
      timestamp: Date.now().toString(),
      ...Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [k, JSON.stringify(v)])
      )
    };

    const id = await this.events.xadd(streamName, "*", eventData);
    console.log(`  ✅ Logged ${eventType} event: ${id}`);
    return id;
  }

  /**
   * Get all events from a stream
   */
  async getEvents(
    streamName: string,
    start: string = "-",
    end: string = "+",
    count?: number
  ): Promise<StreamEntry[]> {
    const results = await this.events.xrange(streamName, start, end, count);
    return this.parseStreamResults(results);
  }

  /**
   * Get latest N events
   */
  async getLatestEvents(streamName: string, count: number = 10): Promise<StreamEntry[]> {
    const results = await this.events.command<any[]>("XREVRANGE", streamName, "+", "-", "COUNT", count);
    return this.parseStreamResults(results);
  }

  /**
   * Get events by time range
   */
  async getEventsByTimeRange(
    streamName: string,
    startTime: number,
    endTime: number
  ): Promise<StreamEntry[]> {
    // Redis stream IDs are timestamp-based: milliseconds-sequence
    const startId = `${startTime}-0`;
    const endId = `${endTime}-9999`;
    
    return await this.getEvents(streamName, startId, endId);
  }

  /**
   * Get events for a specific user
   */
  async getUserEvents(streamName: string, userId: string): Promise<StreamEntry[]> {
    const allEvents = await this.getEvents(streamName);
    return allEvents.filter(e => e.fields.userId === userId);
  }

  /**
   * Get event count
   */
  async getEventCount(streamName: string): Promise<number> {
    return await this.events.xlen(streamName);
  }

  /**
   * Delete specific event(s)
   */
  async deleteEvent(streamName: string, eventId: string): Promise<number> {
    return await this.events.xdel(streamName, eventId);
  }

  /**
   * Trim stream to keep only recent events
   */
  async trimStream(streamName: string, maxLength: number): Promise<void> {
    await this.events.command("XTRIM", streamName, "MAXLEN", "~", maxLength);
    console.log(`  ✂️  Trimmed ${streamName} to ~${maxLength} entries`);
  }

  /**
   * Get event statistics
   */
  async getStats(streamName: string): Promise<{
    totalEvents: number;
    eventTypes: Record<string, number>;
    uniqueUsers: Set<string>;
  }> {
    const events = await this.getEvents(streamName);
    const eventTypes: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    events.forEach(event => {
      const type = event.fields.eventType;
      if (type) {
        eventTypes[type] = (eventTypes[type] || 0) + 1;
      }
      if (event.fields.userId) {
        uniqueUsers.add(event.fields.userId);
      }
    });

    return {
      totalEvents: events.length,
      eventTypes,
      uniqueUsers
    };
  }

  /**
   * Parse Redis stream results into structured format
   */
  private parseStreamResults(results: any[]): StreamEntry[] {
    const entries: StreamEntry[] = [];

    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      
      if (Array.isArray(entry) && entry.length >= 2) {
        const id = String(entry[0]);
        const fields: Record<string, string> = {};

        if (Array.isArray(entry[1])) {
          for (let j = 0; j < entry[1].length; j += 2) {
            const key = String(entry[1][j]);
            const value = String(entry[1][j + 1]);
            fields[key] = value;
          }
        }

        entries.push({ id, fields });
      }
    }

    return entries;
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function displayEvents(events: StreamEntry[], title: string): Promise<void> {
  console.log(`\n${title}`);
  console.log("─".repeat(70));
  
  if (events.length === 0) {
    console.log("  (no events)");
    return;
  }

  events.forEach((event, idx) => {
    const timestamp = new Date(parseInt(event.fields.timestamp || '0'));
    console.log(`\n${idx + 1}. Event ID: ${event.id}`);
    console.log(`   Type: ${event.fields.eventType}`);
    console.log(`   User: ${event.fields.userId}`);
    console.log(`   Time: ${timestamp.toLocaleString()}`);
    
    // Display metadata
    const metadataKeys = Object.keys(event.fields).filter(
      k => !["eventType", "userId", "timestamp"].includes(k)
    );
    
    if (metadataKeys.length > 0) {
      console.log(`   Metadata:`);
      metadataKeys.forEach(key => {
        try {
          const fieldValue = event.fields[key];
          if (fieldValue) {
            const value = JSON.parse(fieldValue);
            console.log(`     ${key}: ${JSON.stringify(value)}`);
          }
        } catch {
          console.log(`     ${key}: ${event.fields[key]}`);
        }
      });
    }
  });
}

async function main() {
  console.log("📝 Demo 6: Event Logging (Streams)\n");

  await using redis = await createRedis("redis://localhost:6379");
  const logger = new EventLogger(redis);

  // ============================================================================
  // Use Case 1: User Activity Tracking
  // ============================================================================
  console.log("👤 Use Case 1: User Activity Tracking");
  console.log("─────────────────────────────────────────");

  console.log("\nLogging user activities...\n");

  await logger.logEvent("user:activity", "login", "user:alice", {
    ip: "192.168.1.100",
    userAgent: "Mozilla/5.0"
  });

  await Bun.sleep(100);

  await logger.logEvent("user:activity", "page_view", "user:alice", {
    page: "/dashboard",
    duration: 5.2
  });

  await Bun.sleep(100);

  await logger.logEvent("user:activity", "purchase", "user:bob", {
    product: "Premium Plan",
    amount: 99.99,
    currency: "USD"
  });

  await Bun.sleep(100);

  await logger.logEvent("user:activity", "logout", "user:alice", {
    sessionDuration: 1847
  });

  // View all activities
  const allActivities = await logger.getEvents("user:activity");
  await displayEvents(allActivities, "📊 All User Activities");

  // ============================================================================
  // Use Case 2: Audit Logging
  // ============================================================================
  console.log("\n\n🔒 Use Case 2: Audit Logging");
  console.log("─────────────────────────────────────────");

  console.log("\nLogging admin actions...\n");

  await logger.logEvent("audit:admin", "user_created", "admin:john", {
    targetUser: "user:charlie",
    role: "editor"
  });

  await Bun.sleep(100);

  await logger.logEvent("audit:admin", "settings_changed", "admin:john", {
    setting: "max_upload_size",
    oldValue: "10MB",
    newValue: "50MB"
  });

  await Bun.sleep(100);

  await logger.logEvent("audit:admin", "user_deleted", "admin:sarah", {
    targetUser: "user:spammer123",
    reason: "ToS violation"
  });

  const auditLogs = await logger.getEvents("audit:admin");
  await displayEvents(auditLogs, "🔍 Audit Trail");

  // ============================================================================
  // Use Case 3: Application Events
  // ============================================================================
  console.log("\n\n⚡ Use Case 3: Application Events");
  console.log("─────────────────────────────────────────");

  console.log("\nLogging application events...\n");

  await logger.logEvent("app:errors", "api_error", "system", {
    endpoint: "/api/users",
    statusCode: 500,
    error: "Database connection timeout"
  });

  await Bun.sleep(100);

  await logger.logEvent("app:performance", "slow_query", "system", {
    query: "SELECT * FROM users WHERE...",
    duration: 3542,
    threshold: 1000
  });

  await Bun.sleep(100);

  await logger.logEvent("app:deployment", "version_deployed", "system", {
    version: "v2.5.0",
    environment: "production",
    deployedBy: "admin:john"
  });

  const appEvents = await logger.getEvents("app:errors");
  await displayEvents(appEvents, "🚨 Application Errors");

  // ============================================================================
  // Feature 1: Get Latest N Events
  // ============================================================================
  console.log("\n\n📅 Latest 3 User Activities");
  console.log("─────────────────────────────────────────");

  const latest = await logger.getLatestEvents("user:activity", 3);
  console.log(`\nFound ${latest.length} recent events:`);
  latest.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.fields.eventType} by ${e.fields.userId}`);
  });

  // ============================================================================
  // Feature 2: Filter by User
  // ============================================================================
  console.log("\n\n👤 Events for user:alice");
  console.log("─────────────────────────────────────────");

  const aliceEvents = await logger.getUserEvents("user:activity", "user:alice");
  console.log(`\nAlice has ${aliceEvents.length} events:`);
  aliceEvents.forEach((e, i) => {
    const time = new Date(parseInt(e.fields.timestamp || '0'));
    console.log(`  ${i + 1}. ${e.fields.eventType} at ${time.toLocaleTimeString()}`);
  });

  // ============================================================================
  // Feature 3: Event Statistics
  // ============================================================================
  console.log("\n\n📊 Event Statistics");
  console.log("─────────────────────────────────────────");

  const stats = await logger.getStats("user:activity");
  console.log(`\nTotal Events: ${stats.totalEvents}`);
  console.log(`Unique Users: ${stats.uniqueUsers.size}`);
  console.log(`\nEvent Types:`);
  Object.entries(stats.eventTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // ============================================================================
  // Feature 4: Time Range Queries
  // ============================================================================
  console.log("\n\n⏰ Events in Last 5 Seconds");
  console.log("─────────────────────────────────────────");

  const now = Date.now();
  const fiveSecondsAgo = now - 5000;
  
  const recentEvents = await logger.getEventsByTimeRange(
    "user:activity",
    fiveSecondsAgo,
    now
  );
  
  console.log(`\nFound ${recentEvents.length} events in the last 5 seconds`);

  // ============================================================================
  // Feature 5: Stream Management
  // ============================================================================
  console.log("\n\n🔧 Stream Management");
  console.log("─────────────────────────────────────────");

  const count = await logger.getEventCount("user:activity");
  console.log(`\nCurrent stream length: ${count} events`);

  // Trim to keep only last 5 events
  await logger.trimStream("user:activity", 5);

  const newCount = await logger.getEventCount("user:activity");
  console.log(`After trimming: ${newCount} events`);

  // ============================================================================
  // Real-World Example: E-commerce Order Tracking
  // ============================================================================
  console.log("\n\n🛒 Real-World: E-commerce Order Tracking");
  console.log("─────────────────────────────────────────");

  console.log("\nTracking order lifecycle...\n");

  const orderId = "ORDER-123";

  await logger.logEvent("orders", "order_created", "user:diana", {
    orderId,
    total: 157.50,
    items: 3
  });

  await Bun.sleep(100);

  await logger.logEvent("orders", "payment_processed", "system", {
    orderId,
    paymentMethod: "credit_card",
    status: "success"
  });

  await Bun.sleep(100);

  await logger.logEvent("orders", "order_shipped", "system", {
    orderId,
    carrier: "FedEx",
    trackingNumber: "1234567890"
  });

  await Bun.sleep(100);

  await logger.logEvent("orders", "order_delivered", "system", {
    orderId,
    signedBy: "Customer"
  });

  const orderEvents = await logger.getEvents("orders");
  await displayEvents(orderEvents, `📦 Order Lifecycle: ${orderId}`);

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use streams for append-only event logs");
  console.log("  ✓ Include timestamp in every event");
  console.log("  ✓ Store structured data as fields");
  console.log("  ✓ Use XRANGE for time-based queries");
  console.log("  ✓ Trim streams regularly to manage memory");
  console.log("  ✓ Consider consumer groups for processing");
  console.log("  ✓ Use separate streams for different event types");
  console.log("  ✓ Include context (userId, IP, etc.) in events");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  const keys = await logger["events"].scanAll("*");
  if (keys.length > 0) {
    await logger["events"].del(...keys);
  }

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
