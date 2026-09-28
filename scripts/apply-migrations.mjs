// supabase/migrations/*.sql 을 순서대로 DB에 적용한다.
// 접속 문자열은 .env.local 의 SUPABASE_DB_URL 에서 읽는다 (Session pooler URI 권장).
// 실행: node scripts/apply-migrations.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env.local 파싱 (dotenv 없이 최소 구현)
function loadEnvLocal() {
  const out = {};
  let raw = '';
  try {
    raw = readFileSync(join(root, '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnvLocal();
const dbUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL 이 없습니다. .env.local 에 Session pooler URI 를 추가하세요.');
  process.exit(1);
}

const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
if (files.length === 0) {
  console.error('✗ 적용할 마이그레이션(.sql)이 없습니다.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('접속 성공. 적용할 파일:', files.join(', '));
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    process.stdout.write(`  → ${f} ... `);
    await client.query(sql); // 파일 전체를 하나의 배치로 실행
    console.log('완료');
  }
  console.log('\n✅ 모든 마이그레이션 적용됨.');
} catch (err) {
  console.error('\n✗ 실패:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
