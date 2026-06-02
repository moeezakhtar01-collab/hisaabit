import "dotenv/config";
import postgres from "postgres";

/**
 * v2 schema migration — additive, idempotent, safe to run repeatedly.
 *
 * Applied by hand (instead of `drizzle-kit push`) because push is an
 * interactive TUI that can't run non-interactively, and it over-cautiously
 * prompts to truncate when adding the device_id unique constraint (unneeded —
 * existing users have NULL device_id, and Postgres treats NULLs as distinct).
 *
 * Names match shared/schema.ts so a later `drizzle-kit push` sees the DB as
 * already in sync. Run against Neon at deploy time by pointing DATABASE_URL there.
 *
 * Run: npx tsx scripts/migrate-v2.ts
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = postgres(process.env.DATABASE_URL);
  const target = process.env.DATABASE_URL.includes("neon.tech") ? "NEON (prod)" : "local";
  console.log(`Applying v2 schema migration to: ${target}`);

  try {
    // users.device_id — frictionless anonymous account key.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id text`;
    await sql`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_device_id_unique'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_device_id_unique UNIQUE (device_id);
      END IF;
    END $$`;

    // expenses.source / expenses.source_hash — provenance + dedupe.
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' NOT NULL`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_hash text`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_source_hash_idx ON expenses (user_id, source_hash)`;

    console.log("✓ v2 schema migration applied");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
