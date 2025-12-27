#!/usr/bin/env bun

/**
 * Non-interactive demo runner.
 *
 * Runs demos sequentially and exits non-zero on first failure.
 *
 * Usage:
 *   bun run demos/run-all.ts
 */

const demoFiles = [
  "00-basic-usage.ts",
  "01-getting-started.ts",
  "02-session-management.ts",
  "03-caching-strategies.ts",
  "04-rate-limiting.ts",
  "05-leaderboard.ts",
  "06-event-logging.ts",
  "07-location-services.ts",
  "08-analytics-hyperloglog.ts",
  "09-multi-tenant.ts",
  "10-job-queue.ts",
  "11-environment-namespaces-cms.ts",
  "12-healthcare-formulary.ts",
  "13-rad-app-development.ts",
  "14-controller-app.ts",
  "15-environment-promotion.ts"
];

function header(title: string) {
  const line = "=".repeat(70);
  console.log(`\n${line}\n${title}\n${line}\n`);
}

for (const file of demoFiles) {
  header(`RUNNING demos/${file}`);

  const proc = Bun.spawn(["bun", "run", `demos/${file}`], {
    stdout: "inherit",
    stderr: "inherit"
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`\n❌ Demo failed: demos/${file} (exit ${exitCode})`);
    process.exit(exitCode);
  }

  console.log(`\n✅ Completed: demos/${file}`);
}

console.log("\n✨ All demos completed successfully");
