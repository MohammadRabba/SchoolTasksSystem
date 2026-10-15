/**
 * Safe database reset script.
 *
 * PRODUCTION PROTECTION:
 *   - Refuses to run if DATABASE_URL looks like a production Neon URL
 *   - Requires explicit --confirm flag for any destructive operation
 *   - Logs the target database before acting
 *
 * Usage:
 *   bun run scripts/safe-reset.js               # Shows what would be reset, then asks
 *   bun run scripts/safe-reset.js --confirm     # Proceeds with reset
 *   bun run scripts/safe-reset.js --force-prod  # Dangerous: bypass production check
 *
 * NEVER use --force-prod unless you have manually verified the DATABASE_URL
 * and you have a recent backup. The script intentionally makes this hard.
 */

const { execSync } = require("child_process");
const readline = require("readline");

const DATABASE_URL = process.env.DATABASE_URL || "";
const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const forceProd = args.includes("--force-prod");

console.log("=== Safe Database Reset ===\n");
console.log(`DATABASE_URL: ${maskUrl(DATABASE_URL)}\n`);

// Detection of production databases
const isPostgres = DATABASE_URL.startsWith("postgres") || DATABASE_URL.startsWith("postgresql");
const isNeon = /neon|\.tech|\.dev.*postgres|render\.com|supabase|railway|\.aivencloud/i.test(DATABASE_URL);
const isSqliteLocalFile = DATABASE_URL.startsWith("file:");

function maskUrl(url) {
  if (!url) return "(unset)";
  // Mask password portion
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

if (isPostgres && isNeon && !forceProd) {
  console.error("⛔ REFUSING TO RESET — looks like a production Neon/PostgreSQL database.");
  console.error("");
  console.error("Detected signals: " + JSON.stringify({ isPostgres, isNeon }));
  console.error("");
  console.error("Production data MUST NOT be reset. The proper way to start a new");
  console.error("school year in production is to mark the old year inactive and");
  console.error("create a new one via Settings → School Years.");
  console.error("");
  console.error("If you are absolutely sure this is a staging or dev Neon database,");
  console.error("you can bypass this protection with --force-prod. But FIRST:");
  console.error("  1. Take a backup:    pg_dump $DATABASE_URL > backup-$(date +%F).sql");
  console.error("  2. Verify the URL:   echo $DATABASE_URL");
  console.error("  3. Then run:         bun run scripts/safe-reset.js --confirm --force-prod");
  process.exit(2);
}

if (isSqliteLocalFile) {
  console.log("Detected SQLite local file — proceeding with reset.");
} else if (isPostgres) {
  console.log("Detected PostgreSQL — proceeding" + (forceProd ? " (--force-prod bypass in effect)" : "") + ".");
}

if (!confirmed) {
  console.log("\nDRY RUN — no changes will be made. To proceed, re-run with --confirm:");
  console.log("  bun run scripts/safe-reset.js --confirm");
  process.exit(0);
}

// Confirm with interactive prompt if running in TTY
if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\nType 'RESET' (uppercase) to confirm: ", (answer) => {
    rl.close();
    if (answer !== "RESET") {
      console.error("Confirmation failed — aborting.");
      process.exit(1);
    }
    doReset();
  });
} else {
  // Non-interactive (CI) — assume --confirm was intentional
  doReset();
}

function doReset() {
  console.log("\nResetting database...");
  try {
    // Run prisma migrate reset with --force (no interactive prompt)
    execSync("npx prisma migrate reset --force --skip-generate", { stdio: "inherit" });
    console.log("\n✓ Database reset complete. Run `bun run db:push` if no migrations exist.");
  } catch (e) {
    console.error("\n✗ Reset failed:", e.message);
    process.exit(1);
  }
}
