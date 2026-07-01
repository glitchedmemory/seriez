const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.zntyjtjodyzizoafxord',
  password: 'Djfbm99#HoH4',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      text TEXT NOT NULL,
      link TEXT DEFAULT '/',
      link_text TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  await client.query(`ALTER TABLE announcements ENABLE ROW LEVEL SECURITY`);
  
  try { await client.query(`CREATE POLICY public_read_active ON announcements FOR SELECT USING (active = true)`); } catch(e) {}
  try { await client.query(`CREATE POLICY authenticated_write ON announcements FOR ALL USING (auth.role() = 'authenticated')`); } catch(e) {}
  
  await client.query(`INSERT INTO announcements (text, link, link_text) VALUES ('Seriez에 오신 것을 환영합니다', '/', '둘러보기 →')`);
  
  console.log('Done');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
