import { RedisWrapper } from "../redis-wrapper";
import { RadAppController } from "../controllers/RadAppController";

/**
 * Demo 13: Rapid Application Development (RAD)
 * 
 * Shows how to use the RadAppController to quickly build a single application
 * with namespaced data, entity storage, and simple state management.
 */

async function runDemo() {
  console.log("🚀 Starting RAD App Development Demo...\n");

  // 1. Initialize Redis and the App Controller
  const redis = await RedisWrapper.connect();
  
  // We'll build a "Task Manager" app in the "task-manager-v1" namespace
  const app = new RadAppController(redis, "task-manager-v1");
  
  console.log("🧹 Cleaning up previous app state...");
  await app.nukeApp();

  // 2. Global State Management
  console.log("\n⚙️  Setting Global App Configuration...");
  await app.setState("config", {
    theme: "dark",
    maxTasksPerUser: 50,
    maintenanceMode: false
  });
  
  const config = await app.getState("config");
  console.log("   Current Config:", config);

  // 3. User Management (Entity Storage)
  console.log("\n👤 Creating Users...");
  
  interface User {
    name: string;
    email: string;
    role: "admin" | "user";
    joinedAt: string;
  }

  await app.saveEntity<User>("users", "u1", {
    name: "Alice Admin",
    email: "alice@example.com",
    role: "admin",
    joinedAt: new Date().toISOString()
  });

  await app.saveEntity<User>("users", "u2", {
    name: "Bob Builder",
    email: "bob@example.com",
    role: "user",
    joinedAt: new Date().toISOString()
  });

  const userIds = await app.listEntityIds("users");
  console.log(`   Created ${userIds.length} users: ${userIds.join(", ")}`);

  const alice = await app.getEntity<User>("users", "u1");
  console.log("   Retrieved Alice:", alice?.name);

  // 4. Task Management (Entity Storage + Counters)
  console.log("\n📝 Creating Tasks...");

  interface Task {
    title: string;
    assignedTo: string;
    status: "pending" | "done";
  }

  // Helper to create a task
  const createTask = async (title: string, assignedTo: string) => {
    const taskId = await app.incrementCounter("task_id_seq");
    const id = `t${taskId}`;
    
    await app.saveEntity<Task>("tasks", id, {
      title,
      assignedTo,
      status: "pending"
    });
    
    // Add to activity feed
    await app.pushToFeed("activity", {
      action: "task_created",
      taskId: id,
      title,
      timestamp: Date.now()
    });
    
    return id;
  };

  const t1 = await createTask("Fix login bug", "u1");
  const t2 = await createTask("Design homepage", "u2");
  const t3 = await createTask("Write documentation", "u1");

  console.log(`   Created tasks: ${t1}, ${t2}, ${t3}`);
  
  const totalTasks = await app.getCounter("task_id_seq");
  console.log(`   Total tasks created ever: ${totalTasks}`);

  // 5. Feeds / Activity Log
  console.log("\n📜 Recent Activity Feed:");
  const activities = await app.getRecentFeedItems("activity", 5);
  activities.forEach((act: any) => {
    console.log(`   - [${new Date(act.timestamp).toLocaleTimeString()}] ${act.action}: ${act.title}`);
  });

  // 6. Listing Data
  console.log("\n📋 All Tasks:");
  const allTasks = await app.listEntities<Task>("tasks");
  allTasks.forEach(t => {
    console.log(`   - [${t.status.toUpperCase()}] ${t.title} (@${t.assignedTo})`);
  });

  // 7. Cleanup
  console.log("\n🗑️  Deleting a user...");
  await app.deleteEntity("users", "u2");
  const remainingUsers = await app.listEntityIds("users");
  console.log(`   Remaining users: ${remainingUsers.join(", ")}`);

  console.log("\n✅ RAD Demo Complete!");
  process.exit(0);
}

runDemo().catch(console.error);
