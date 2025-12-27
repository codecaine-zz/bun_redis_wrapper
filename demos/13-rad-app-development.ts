/**
 * Demo 13: RAD App Development (fast + minimal)
 *
 * Goal: show the smallest useful end-to-end flow:
 * 1) app state (set/get)
 * 2) entity storage (save/get/list)
 * 3) activity feed (push/read)
 * 4) cleanup (reset namespace)
 */

import { createRedis } from "../src/index.ts";
import { RadAppController } from "../src/controllers/RadAppController.ts";

async function main() {
  await using redis = await createRedis(process.env.REDIS_URL);

  const app = new RadAppController(redis, "task-manager-v1");
  await app.nukeApp();

  await app.setState("config", { maintenanceMode: false });
  console.log("config:", await app.getState("config"));

  await app.saveEntity("users", "u1", { name: "Alice" });
  console.log("userIds:", await app.listEntityIds("users"));
  console.log("user u1:", await app.getEntity("users", "u1"));

  const taskNum = await app.incrementCounter("task_seq");
  const taskId = `t${taskNum}`;
  await app.saveEntity("tasks", taskId, { title: "Fix login bug", status: "pending" });
  await app.pushToFeed("activity", { action: "task_created", taskId, at: Date.now() });
  console.log("activity:", await app.getRecentFeedItems("activity", 3));

  await app.nukeApp();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
