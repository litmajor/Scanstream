import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://scanuser:scanpass@localhost:5432/scandb';

async function runMigrations() {
  console.log('[Migration] Starting Phase 5 migrations...');
  console.log(`[Migration] Database: ${DATABASE_URL.replace(/:[^@]*@/, ':****@')}`);

  const sql = postgres(DATABASE_URL);

  try {
    // Read migration file
    const migrationPath = join(process.cwd(), 'server/migrations/002_phase5_frontend_tables.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`[Migration] Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[Migration] Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await sql.unsafe(statement);
        console.log(`[Migration] ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate key')) {
          console.log(`[Migration] ⚠️ Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`[Migration] ❌ Statement ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('[Migration] ✅ All migrations completed successfully!');

    // Verify tables were created
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('signal_history', 'agent_performance', 'market_regime', 'regime_transitions', 'signal_source_metrics', 'daily_risk_budget')
      ORDER BY table_name
    `;

    console.log(`[Migration] ✅ Verified ${tables.length} Phase 5 tables created:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
