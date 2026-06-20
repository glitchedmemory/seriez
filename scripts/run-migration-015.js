// Run Supabase SQL migration
const { execSync } = require('child_process');

// Install pg if not available
try { require('pg'); } catch { execSync('npm install pg', { cwd: __dirname, stdio: 'inherit' }); }

const { Client } = require('pg');
const { readFileSync } = require('fs');
const path = require('path');

// Read env
const projectRoot = path.resolve(__dirname, '..');
const envContent = readFileSync(path.join(projectRoot, '.env.local'), 'utf-8');
const getEnv = (key) => envContent.split('\n').find(l => l.startsWith(key + '='))?.split('=')[1]?.trim() || '';

const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const sql = readFileSync(path.join(projectRoot, 'supabase/migrations/015_anti_spam.sql'), 'utf-8');

if (!serviceKey) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function run() {
  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.zntyjtjodyzizoafxord',
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
