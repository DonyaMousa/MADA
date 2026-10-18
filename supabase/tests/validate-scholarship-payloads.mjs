// Exercise the actual prepared rows against the exact migrations in disposable PG17.
// The transaction is rolled back; this script has no remote database configuration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {db, validate} from './validate-database.mjs';

const order=['scholarship_sources','fetch_runs','scholarships','scholarship_snapshots','scholarship_variants',
  'scholarship_requirements','scholarship_language_requirements','scholarship_required_documents',
  'scholarship_deadlines','scholarship_funding','scholarship_evidence','scholarship_change_history'];
let failed=false;
try {
  await validate();
  const payload=JSON.parse(fs.readFileSync('data/scraping/database_ready/daad_supabase_payloads.json','utf8'));
  assert.deepEqual(Object.keys(payload).sort(),[...order].sort());
  await db.exec('begin; set local role service_role;');
  const counts={};
  for (const table of order) {
    const rows=payload[table]; counts[table]=rows.length;
    if (!rows.length) continue;
    const keys=Object.keys(rows[0]);
    for (const row of rows) assert.deepEqual(Object.keys(row),keys,`${table} row shape`);
    for (const key of keys) assert(/^[a-z_][a-z0-9_]*$/.test(key));
    const columns=keys.map(k=>`"${k}"`).join(',');
    await db.query(`insert into public.${table} (${columns}) select ${columns} from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`,[JSON.stringify(rows)]);
  }
  // Force deferred scholarship -> latest-snapshot ownership checks before rollback.
  await db.exec('set constraints all immediate;');
  const research=payload.scholarships.find(r=>r.source_record_id==='57742121');
  const language=(await db.query(`select distinct test_name,minimum_score::float as score from public.scholarship_language_requirements
    where scholarship_id=$1 and minimum_score is not null order by test_name`,[research.id])).rows;
  assert(language.some(r=>r.test_name==='IELTS'&&r.score===6.5));
  assert(language.some(r=>r.test_name==='TOEFL iBT'&&r.score===79));
  const publications=(await db.query(`select applicant_status,maximum_pages from public.scholarship_required_documents
    where scholarship_id=$1 and document_type='publication_list'`,[research.id])).rows;
  assert(publications.length===1&&publications[0].applicant_status==='Postdoctoral researchers'&&publications[0].maximum_pages===10);
  assert((await db.query('select count(*)::int as n from public.scholarship_requirements where minimum_gpa is not null')).rows[0].n===0);
  assert(payload.scholarships.every(r=>r.published===false&&r.verification_state==='needs_review'));
  const epos=payload.scholarships.find(r=>r.source_record_id==='50076777');
  const courses=(await db.query(`select normalized_payload->'courses' as courses from public.scholarship_snapshots where scholarship_id=$1`,[epos.id])).rows[0].courses;
  assert(courses.length===25&&courses.every(c=>c.institution&&c.official_course_websites.length&&c.application_deadline===null));
  assert(epos.deadline_at===null);
  assert(!payload.scholarship_requirements.some(r=>r.category==='language'&&/\bresid(?:ent|ed|ence)/i.test(r.original_text)));
  await db.exec('rollback;');
  const report={passed:true,checked_at:new Date().toISOString(),engine:'PostgreSQL 17.5 / PGlite',
    counts,rows_checked:Object.values(counts).reduce((a,b)=>a+b,0),remote_writes:0,
    payload_sha256:createHash('sha256').update(fs.readFileSync('data/scraping/database_ready/daad_supabase_payloads.json')).digest('hex'),
    transaction:'rolled back; disposable local validation only',checks:['real typed row inserts','all SQL CHECKs and FKs','deferred latest snapshot ownership',
      'research IELTS 6.5 / TOEFL iBT 79','publication list scoped to postdoctoral applicants','no invented minimum GPA',
      '25 course rows and websites survive snapshot JSON round-trip','no shared EPOS deadline','residence is not language','all scholarships unpublished and needs_review']};
  fs.writeFileSync('data/scraping/reports/daad_sql_payload_validation.json',JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: ${report.rows_checked} actual prepared rows satisfy the PostgreSQL schema; transaction rolled back.`);
} catch(error) {
  try {await db.exec('rollback;');} catch {}
  console.error(`${error.code??''} ${error.message}`);failed=true;
} finally {await db.close();}
if(failed)process.exitCode=1;
