// Optional CLI type generation from the same disposable PostgreSQL 17 validation DB.
// Install @electric-sql/pglite-socket@0.1.6 alongside @electric-sql/pglite@0.4.6.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db, validate } from './validate-database.mjs';
import { PGLiteSocketServer } from '../.temp/validation/node_modules/@electric-sql/pglite-socket/dist/index.js';

const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55439 });
const cliEnv = { ...process.env, DO_NOT_TRACK: '1', SUPABASE_HOME: path.resolve('supabase/.temp/cli-home') };
const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:55439/postgres?sslmode=disable';
async function cli(args) {
  return promisify(execFile)(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], {
    env: cliEnv, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
}
let failed = false;
try {
  await server.start();
  await validate({ applyMigration: async () => {
    await cli(['migration', 'up', '--db-url', dbUrl]);
    console.log('PASS: Supabase CLI applied the versioned migration to clean localhost PostgreSQL.');
    const result = await db.query("select version from supabase_migrations.schema_migrations order by version");
    const expected = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort().map(f => f.split('_')[0]);
    if (JSON.stringify(result.rows.map(r => r.version)) !== JSON.stringify(expected)) {
      throw new Error('Unexpected CLI migration history');
    }
  } });
  const { stdout, stderr } = await cli([
    'gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'public',
  ]);
  if (!stdout.includes('export type Database')) throw new Error(`No database types returned: ${stderr}`);
  fs.mkdirSync('supabase/types', { recursive: true });
  fs.writeFileSync('supabase/types/database.types.ts', stdout);
  console.log('PASS: Supabase CLI generated supabase/types/database.types.ts from localhost PostgreSQL.');
} catch (error) {
  console.error(error.message);
  failed = true;
} finally {
  await server.stop();
  await db.close();
}
if (failed) process.exitCode = 1;
