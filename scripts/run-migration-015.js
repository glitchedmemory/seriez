// Run Supabase SQL migration
// Usage: node scripts/run-migration-015.js [project-root]
const { execSync } = require('child_process');
const path = require('path');

const projectRoot = process.argv[2] || path.resolve(__dirname, '..');

// Install pg if not available (look in project node_modules first)
try { require(path.join(projectRoot, 'node_modules/pg')); } 
catch { try { require('pg'); } catch { execSync('npm install pg', { cwd: projectRoot, stdio: 'inherit' }); } }

const { Client } = require('pg');
const { readFileSync } = require('fs');

// Read env
const envContent = readFileSync(path.join(projectRoot, '.env.local'), 'utf-8');

function getEnv(key) {
  const line = envContent.split('\n').find(l => l.startsWith(key + '='));
  if (!line) return '';
  const val = line.split('=').slice(1).join('='); // handle values with =
  return val.replace(/["'\r\n]/g, '').trim();
}

const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const sql = readFileSync(path.join(projectRoot, 'supabase/migrations/015_anti_spam.sql'), 'utf-8');

if (!serviceKey) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function run() {
  const client = new Client({
    host: 'db.zntyjtjodyzizoafxord.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: serviceKey,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');
    await client.query(sql);
    console.log('Migration 015_anti_spam.sql applied successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
