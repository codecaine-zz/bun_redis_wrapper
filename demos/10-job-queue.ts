/**
 * Demo 10: Job Queue System
 * 
 * Demonstrates building a job queue system with Redis:
 * - Job submission and queuing
 * - Worker processing
 * - Job priorities
 * - Job status tracking
 * - Retry logic and failure handling
 * 
 * Run with: bun run demos/10-job-queue.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Job {
  id: string;
  type: string;
  payload: any;
  priority: number;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
}

// ============================================================================
// Job Queue Manager Class
// ============================================================================

class JobQueueManager {
  private queue;

  constructor(redis: any, queueName: string = "jobs") {
    this.queue = createNamespacedRedis(redis, queueName);
  }

  /**
   * Add job to queue
   */
  async addJob(
    type: string,
    payload: any,
    priority: number = 0,
    maxAttempts: number = 3
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    
    const job: Job = {
      id: jobId,
      type,
      payload,
      priority,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts
    };

    // Store job data
    await this.queue.setJSON(`job:${jobId}`, job);
    
    // Add to priority queue (sorted set by priority, higher = more important)
    await this.queue.zadd("pending", [priority, jobId]);
    
    console.log(`  ✅ Added job ${jobId} (${type}) with priority ${priority}`);
    return jobId;
  }

  /**
   * Get next job to process (highest priority first)
   */
  async getNextJob(): Promise<Job | null> {
    // Get highest priority job
    const results = await this.queue.zrange("pending", -1, -1);
    
    if (!results || results.length === 0) {
      return null;
    }

    const jobId = String(results[0]);
    
    // Remove from pending queue
    await this.queue.zrem("pending", jobId);
    
    // Get job data
    const job = await this.queue.getJSON<Job>(`job:${jobId}`);
    
    if (!job) return null;

    // Update status
    job.status = "processing";
    job.startedAt = Date.now();
    job.attempts++;
    
    await this.queue.setJSON(`job:${jobId}`, job);
    
    return job;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJSON<Job>(`job:${jobId}`);
    
    if (!job) return;

    job.status = "completed";
    job.completedAt = Date.now();
    
    await this.queue.setJSON(`job:${jobId}`, job);
    
    // Add to completed set
    await this.queue.sadd("completed", jobId);
    
    console.log(`  ✅ Completed job ${jobId}`);
  }

  /**
   * Mark job as failed and optionally retry
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const job = await this.queue.getJSON<Job>(`job:${jobId}`);
    
    if (!job) return;

    job.error = error;

    // Check if we should retry
    if (job.attempts < job.maxAttempts) {
      console.log(`  🔄 Retrying job ${jobId} (attempt ${job.attempts}/${job.maxAttempts})`);
      
      // Reset status and re-queue with lower priority
      job.status = "pending";
      await this.queue.setJSON(`job:${jobId}`, job);
      await this.queue.zadd("pending", [job.priority - 1, jobId]);
    } else {
      console.log(`  ❌ Failed job ${jobId} (max attempts reached)`);
      
      job.status = "failed";
      job.completedAt = Date.now();
      await this.queue.setJSON(`job:${jobId}`, job);
      
      // Add to failed set
      await this.queue.sadd("failed", jobId);
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return await this.queue.getJSON<Job>(`job:${jobId}`);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
  }> {
    const pending = await this.queue.zcard("pending");
    const completed = await this.queue.command<number>("SCARD", "completed");
    const failed = await this.queue.command<number>("SCARD", "failed");

    return { pending, completed, failed };
  }

  /**
   * Get all jobs with status
   */
  async getJobsByStatus(status: Job["status"]): Promise<Job[]> {
    const jobs: Job[] = [];

    if (status === "pending") {
      const jobIds = await this.queue.zrange("pending", 0, -1);
      for (const id of jobIds) {
        const job = await this.getJob(String(id));
        if (job) jobs.push(job);
      }
    } else if (status === "completed" || status === "failed") {
      const jobIds = await this.queue.smembers(status);
      for (const id of jobIds) {
        const job = await this.getJob(id);
        if (job) jobs.push(job);
      }
    }

    return jobs;
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<number> {
    const completedIds = await this.queue.smembers("completed");
    
    if (completedIds.length === 0) return 0;

    // Delete job data
    const jobKeys = completedIds.map(id => `job:${id}`);
    await this.queue.del(...jobKeys);
    
    // Clear completed set
    await this.queue.del("completed");
    
    console.log(`  🧹 Cleared ${completedIds.length} completed jobs`);
    return completedIds.length;
  }
}

// ============================================================================
// Worker Class
// ============================================================================

class Worker {
  private queue: JobQueueManager;
  private name: string;
  private running: boolean = false;

  constructor(queue: JobQueueManager, name: string) {
    this.queue = queue;
    this.name = name;
  }

  /**
   * Process jobs
   */
  async start(maxJobs?: number): Promise<void> {
    this.running = true;
    let processed = 0;

    console.log(`  🔧 Worker ${this.name} started`);

    while (this.running) {
      const job = await this.queue.getNextJob();

      if (!job) {
        // No jobs available
        break;
      }

      console.log(`  🔨 Worker ${this.name} processing job ${job.id} (${job.type})`);

      try {
        // Simulate job processing
        await this.processJob(job);
        await this.queue.completeJob(job.id);
        processed++;
      } catch (error) {
        await this.queue.failJob(job.id, String(error));
      }

      // Check if we've hit max jobs
      if (maxJobs && processed >= maxJobs) {
        break;
      }
    }

    console.log(`  🛑 Worker ${this.name} stopped (processed ${processed} jobs)`);
  }

  /**
   * Process individual job
   */
  private async processJob(job: Job): Promise<void> {
    // Simulate different job types
    await Bun.sleep(100); // Simulate work

    if (job.type === "email") {
      // Simulate sending email
      if (Math.random() < 0.1) throw new Error("SMTP connection failed");
    } else if (job.type === "report") {
      // Simulate generating report
      if (Math.random() < 0.05) throw new Error("Database timeout");
    } else if (job.type === "export") {
      // Simulate data export
      await Bun.sleep(200); // Longer operation
    }
  }

  stop(): void {
    this.running = false;
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function main() {
  console.log("⚙️  Demo 10: Job Queue System\n");

  await using redis = await createRedis("redis://localhost:6379");
  const jobQueue = new JobQueueManager(redis);

  // ============================================================================
  // Use Case 1: Basic Job Submission
  // ============================================================================
  console.log("📝 Use Case 1: Job Submission");
  console.log("─────────────────────────────────────────");

  console.log("\nSubmitting jobs...\n");

  // Add various jobs with different priorities
  await jobQueue.addJob("email", { to: "user@example.com", subject: "Welcome!" }, 5);
  await jobQueue.addJob("report", { type: "monthly", userId: "123" }, 8);
  await jobQueue.addJob("export", { format: "csv", dataSet: "users" }, 3);
  await jobQueue.addJob("email", { to: "admin@example.com", subject: "Alert" }, 10);
  await jobQueue.addJob("report", { type: "daily", userId: "456" }, 7);

  let stats = await jobQueue.getStats();
  console.log(`\nQueue stats: ${stats.pending} pending, ${stats.completed} completed, ${stats.failed} failed`);

  // ============================================================================
  // Use Case 2: Worker Processing
  // ============================================================================
  console.log("\n\n🔧 Use Case 2: Worker Processing");
  console.log("─────────────────────────────────────────");

  console.log("\nStarting workers...\n");

  const worker1 = new Worker(jobQueue, "Worker-1");
  const worker2 = new Worker(jobQueue, "Worker-2");

  // Process jobs concurrently
  await Promise.all([
    worker1.start(3), // Process max 3 jobs
    worker2.start(2)  // Process max 2 jobs
  ]);

  stats = await jobQueue.getStats();
  console.log(`\nQueue stats: ${stats.pending} pending, ${stats.completed} completed, ${stats.failed} failed`);

  // ============================================================================
  // Use Case 3: Job Status Tracking
  // ============================================================================
  console.log("\n\n📊 Use Case 3: Job Status Tracking");
  console.log("─────────────────────────────────────────");

  const completedJobs = await jobQueue.getJobsByStatus("completed");
  
  console.log(`\nCompleted jobs (${completedJobs.length}):`);
  completedJobs.forEach((job, i) => {
    const duration = job.completedAt && job.startedAt 
      ? job.completedAt - job.startedAt 
      : 0;
    console.log(`  ${i + 1}. ${job.type} - ${duration}ms (${job.attempts} attempts)`);
  });

  // ============================================================================
  // Use Case 4: Retry Logic
  // ============================================================================
  console.log("\n\n🔄 Use Case 4: Retry Logic");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding job that will fail...\n");

  // Add a job and manually fail it to demonstrate retry
  const retryJobId = await jobQueue.addJob("email", { to: "test@example.com" }, 5, 3);
  
  const retryJob = await jobQueue.getNextJob();
  if (retryJob) {
    await jobQueue.failJob(retryJob.id, "Connection timeout");
  }

  // Check if job was re-queued
  stats = await jobQueue.getStats();
  console.log(`\nJob re-queued for retry. Pending: ${stats.pending}`);

  // Process retry
  console.log("\nProcessing retry...\n");
  const worker3 = new Worker(jobQueue, "Worker-3");
  await worker3.start(1);

  // ============================================================================
  // Use Case 5: Priority Queue
  // ============================================================================
  console.log("\n\n⚡ Use Case 5: Priority Queue");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding jobs with different priorities...\n");

  await jobQueue.addJob("low", { data: "low priority" }, 1);
  await jobQueue.addJob("high", { data: "high priority" }, 10);
  await jobQueue.addJob("urgent", { data: "urgent!" }, 20);
  await jobQueue.addJob("medium", { data: "medium priority" }, 5);

  console.log("Processing in priority order:\n");

  // Process all jobs to show priority order
  while ((await jobQueue.getStats()).pending > 0) {
    const job = await jobQueue.getNextJob();
    if (job) {
      console.log(`  Processing: ${job.type} (priority ${job.priority})`);
      await jobQueue.completeJob(job.id);
    }
  }

  // ============================================================================
  // Use Case 6: Batch Job Processing
  // ============================================================================
  console.log("\n\n📦 Use Case 6: Batch Job Processing");
  console.log("─────────────────────────────────────────");

  console.log("\nSubmitting batch of 20 jobs...\n");

  for (let i = 1; i <= 20; i++) {
    await jobQueue.addJob(
      "batch_process",
      { item: i },
      Math.floor(Math.random() * 10)
    );
  }

  console.log("Processing batch with 3 workers...\n");

  const batchWorkers = [
    new Worker(jobQueue, "BatchWorker-1"),
    new Worker(jobQueue, "BatchWorker-2"),
    new Worker(jobQueue, "BatchWorker-3")
  ];

  await Promise.all(
    batchWorkers.map(worker => worker.start(7))
  );

  stats = await jobQueue.getStats();
  console.log(`\nBatch complete: ${stats.completed} completed`);

  // ============================================================================
  // Use Case 7: Job Analytics
  // ============================================================================
  console.log("\n\n📈 Use Case 7: Job Analytics");
  console.log("─────────────────────────────────────────");

  const allCompleted = await jobQueue.getJobsByStatus("completed");
  
  // Calculate stats
  const avgDuration = allCompleted.reduce((sum, job) => {
    const duration = job.completedAt && job.startedAt 
      ? job.completedAt - job.startedAt 
      : 0;
    return sum + duration;
  }, 0) / allCompleted.length;

  const jobTypes = allCompleted.reduce((acc, job) => {
    acc[job.type] = (acc[job.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nJob analytics:");
  console.log(`  Total completed: ${allCompleted.length}`);
  console.log(`  Average duration: ${avgDuration.toFixed(0)}ms`);
  console.log("\n  By type:");
  Object.entries(jobTypes).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n\n🧹 Cleanup");
  console.log("─────────────────────────────────────────");

  await jobQueue.clearCompleted();

  stats = await jobQueue.getStats();
  console.log(`\nFinal stats: ${stats.pending} pending, ${stats.completed} completed, ${stats.failed} failed`);

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use sorted sets for priority queues");
  console.log("  ✓ Store job metadata separately from queue");
  console.log("  ✓ Implement retry logic with max attempts");
  console.log("  ✓ Track job status (pending/processing/completed/failed)");
  console.log("  ✓ Use multiple workers for parallel processing");
  console.log("  ✓ Set TTL on completed jobs to auto-cleanup");
  console.log("  ✓ Monitor queue depth and processing times");
  console.log("  ✓ Implement dead letter queue for failed jobs");
  console.log("  ✓ Consider using Redis Streams for advanced queuing");

  // Final cleanup
  const keys = await jobQueue["queue"].scanAll("*");
  if (keys.length > 0) {
    await jobQueue["queue"].del(...keys);
  }

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
