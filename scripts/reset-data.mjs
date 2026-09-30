// 데이터 초기화 도구. 기본은 "미리보기"(행 수만 출력, 삭제 안 함).
// 실제 삭제는 인자로 명시해야 실행된다:
//   node scripts/reset-data.mjs               # 미리보기(행 수)
//   node scripts/reset-data.mjs --confirm      # 전부 하드 삭제(공간 포함)
//   node scripts/reset-data.mjs --confirm --keep-spaces  # 공간은 두고 할 일/그룹/반복만
// 접속 문자열은 .env.local 의 SUPABASE_DB_URL 에서 읽는다(값은 절대 출력하지 않음).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  console.error('✗ SUPABASE_DB_URL 이 없습니다. .env.local 을 확인하세요.');
  process.exit(1);
}

const confirm = process.argv.includes('--confirm');
const keepSpaces = process.argv.includes('--keep-spaces');

// FK 의존 순서: tasks → (recurrences·groups) → spaces
const TABLES = ['tasks', 'recurrences', 'groups', 'spaces'];

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // 현재 상태(미리보기)
  console.log('현재 데이터:');
  for (const t of TABLES) {
    const { rows } = await client.query(`select count(*)::int as n from public.${t}`);
    console.log(`  ${t.padEnd(12)} ${rows[0].n}`);
  }
  const users = await client.query(
    'select count(distinct user_id)::int as n from public.spaces'
  );
  console.log(`  (구별되는 user_id: ${users.rows[0].n})`);

  if (!confirm) {
    console.log('\n미리보기만 했습니다. 삭제하려면 --confirm 을 붙여 다시 실행하세요.');
    await client.end();
    return;
  }

  const targets = keepSpaces ? ['tasks', 'recurrences', 'groups'] : TABLES;
  console.log(`\n삭제 시작 (하드 삭제): ${targets.join(', ')}`);
  await client.query('begin');
  try {
    for (const t of targets) {
      const res = await client.query(`delete from public.${t}`);
      console.log(`  ${t.padEnd(12)} -${res.rowCount}`);
    }
    await client.query('commit');
    console.log('✓ 완료. 앱을 새로고침하면' + (keepSpaces ? ' 기존 공간이 그대로 보입니다.' : ' 개인/회사 공간이 새로 시드됩니다.'));
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
  await client.end();
}

main().catch((e) => {
  console.error('✗ 실패:', e.message);
  process.exit(1);
});
