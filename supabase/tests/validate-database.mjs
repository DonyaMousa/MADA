// Disposable embedded PostgreSQL fallback. Does not read credentials or contact Supabase.
// npm install --prefix supabase/.temp/validation --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.4.6
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '../.temp/validation/node_modules/@electric-sql/pglite/dist/index.js';
import { pgcrypto } from '../.temp/validation/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import { pg_trgm } from '../.temp/validation/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js';
import { validateScholarshipDetails } from './validate-scholarship-details.mjs';

export const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
let checks = 0;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const u1 = uid(1), u2 = uid(2), admin = uid(3);
const s1 = uid(11), s2 = uid(12), draft = uid(13);
const a1 = uid(21), a2 = uid(22), d1 = uid(31), d2 = uid(32);
const l1 = uid(41), c1 = uid(51), e1 = uid(61), m1 = uid(71), n1 = uid(81);
const hash = 'a'.repeat(64);

async function ok(label, sql, expected) {
  const result = await db.query(sql);
  if (expected !== undefined) assert.deepEqual(result.rows, expected, label);
  checks++;
}
async function denied(label, sql, codes = ['42501']) {
  try { await db.exec(sql); } catch (error) {
    assert(codes.includes(error.code), `${label}: expected ${codes}, got ${error.code}: ${error.message}`);
    checks++;
    return;
  }
  throw new Error(`${label}: unexpectedly succeeded`);
}
async function as(role, id) {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub', '${id ?? ''}', false);`);
}

export async function validate({ applyMigration } = {}) {
  // Minimal Supabase-managed schemas only. The migration itself is unmodified.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text not null, unique(bucket_id, name));
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1];
    $$;
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
    -- Reproduce permissive Supabase defaults to verify the migration removes them.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  if (applyMigration) await applyMigration();
  else for (const file of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  checks++;
  console.log('PASS: exact migration applied to empty embedded PostgreSQL database.');

  await ok('all 37 tables have RLS', `select count(*)::int as n from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`, [{ n: 37 }]);
  await ok('private documents bucket preserved', `select public, file_size_limit::int as size
    from storage.buckets where id = 'documents'`, [{ public: false, size: 10485760 }]);

  await db.exec(`insert into auth.users(id,raw_user_meta_data) values
    ('${u1}','{"role":"admin"}'), ('${u2}','{}'), ('${admin}','{}');
    update public.user_roles set role = 'admin' where user_id = '${admin}';`);
  await ok('signup creates student role regardless of metadata',
    `select role from public.user_roles where user_id = '${u1}'`, [{ role: 'student' }]);
  await ok('signup creates profile and preferences', `select count(*)::int as n
    from public.profiles p join public.reminder_preferences r on r.user_id = p.id`, [{ n: 3 }]);

  await db.exec(`insert into public.scholarships (id,slug,title,provider,funding_type,
    eligibility_summary,official_application_url,official_source_url,source_url,published,verification_state,last_verified_at)
    values ('${s1}','one','Scholarship One','University','full','Rules','https://example.org/app','https://example.org','https://example.org',true,'verified',current_date),
    ('${s2}','two','Scholarship Two','University','partial','Rules','https://example.org/app','https://example.org','https://example.org',true,'verified',current_date),
    ('${draft}','draft','Draft','University','unknown','Rules','https://example.org/app','https://example.org','https://example.org',false,'draft',null);
    insert into public.applications(id,user_id,scholarship_id) values ('${a1}','${u1}','${s1}'),('${a2}','${u2}','${s1}');
    insert into storage.objects(bucket_id,name) values ('documents','${u1}/cv.pdf'),('documents','${u2}/cv.pdf');
    insert into public.documents(id,user_id,kind,original_name,safe_name,mime_type,byte_size,storage_path)
    values ('${d1}','${u1}','cv','cv.pdf','cv.pdf','application/pdf',100,'${u1}/cv.pdf'),
           ('${d2}','${u2}','cv','cv.pdf','cv.pdf','application/pdf',100,'${u2}/cv.pdf');
    insert into public.letter_drafts(id,user_id,scholarship_id,application_id,title) values ('${l1}','${u2}','${s1}','${a2}','Letter');
    insert into public.assistant_conversations(id,user_id,scholarship_id,application_id) values ('${c1}','${u2}','${s1}','${a2}');
    insert into public.cv_extractions(id,document_id,user_id,status,model_provider,model_version,extractor_version,schema_version,input_sha256)
    values ('${e1}','${d1}','${u1}','pending','test','test-1','1','1','${hash}');
    insert into public.matches(id,user_id,scholarship_id,cv_extraction_id,eligibility_status,eligibility_results,
      total_score,score_breakdown,explanation,model_versions,scorer_version,eligibility_version,input_fingerprint,profile_updated_at,scholarship_updated_at)
    values ('${m1}','${u1}','${s1}','${e1}','eligible','[]',85,'{"preferences":85}','{"summary":"test"}',
      '{"embedding":"test-1"}','1','1','${hash}',now(),now());
    insert into public.notifications(id,user_id,kind,title,body) values ('${n1}','${u1}','deadline','Due','Soon');
  `);

  await as('anon');
  await ok('anonymous reads published directory', 'select count(*)::int as n from public.scholarships', [{ n: 2 }]);
  await denied('anonymous cannot read profiles', 'select * from public.profiles');
  await denied('anonymous cannot read documents', 'select * from public.documents');
  await ok('anonymous cannot read private storage', 'select count(*)::int as n from storage.objects', [{ n: 0 }]);
  await ok('public proposal submission works', `insert into public.provider_proposals
    (organization,contact_email,listing_title,official_source_url) values ('Org','a@example.org','Title','https://example.org')`);
  await denied('proposal cannot self-approve', `insert into public.provider_proposals
    (organization,contact_email,listing_title,official_source_url,status) values ('Org','a@example.org','Title','https://example.org','approved')`);
  await denied('anonymous cannot read proposals', 'select * from public.provider_proposals');

  await as('authenticated', u1);
  await ok('student reads only own profile', 'select id from public.profiles', [{ id: u1 }]);
  await ok('student reads only own documents', 'select id from public.documents', [{ id: d1 }]);
  await ok('student reads own generated match', 'select id from public.matches', [{ id: m1 }]);
  await ok('student reads own CV extraction', 'select id from public.cv_extractions', [{ id: e1 }]);
  await ok('profile update permitted', `update public.profiles set display_name = 'Student', gpa=3.5,gpa_scale=4 where id = '${u1}'`);
  await denied('role elevation denied', `update public.user_roles set role='admin' where user_id='${u1}'`);
  await denied('role insertion denied', `insert into public.user_roles(user_id,role) values ('${uid(4)}','admin')`);
  await denied('profile identity immutable', `update public.profiles set id='${uid(4)}' where id='${u1}'`);
  await denied('CV suggestions cannot be forged', `update public.profiles set cv_extracted_suggestions='{}' where id='${u1}'`);
  await denied('CV raw extracted text cannot be forged', `update public.documents set extracted_text='fake' where id='${d1}'`);
  await denied('document path cannot be reassigned', `update public.documents set storage_path='${u2}/cv.pdf' where id='${d1}'`);
  await denied('invalid GPA rejected', `update public.profiles set gpa=5,gpa_scale=4 where id='${u1}'`, ['23514']);
  await denied('invalid timezone rejected', `update public.profiles set timezone='Invalid/Zone' where id='${u1}'`, ['23514']);
  await denied('invalid reminder offsets rejected', `update public.reminder_preferences set due_soon_days=20,upcoming_days=10 where user_id='${u1}'`, ['23514']);
  await ok('student cannot publish scholarship', `update public.scholarships set published=true where id='${draft}' returning id`, []);
  await denied('student cannot save unpublished scholarship', `insert into public.saved_scholarships values ('${u1}','${draft}',now())`);
  await denied('official deadline snapshot is service-owned', `update public.applications set official_deadline_at=now() where id='${a1}'`);
  await denied('cross-user task blocked', `insert into public.application_tasks(application_id,user_id,title) values ('${a2}','${u1}','Task')`, ['23503']);
  await denied('cross-user document attachment blocked', `insert into public.document_attachments(document_id,application_id,user_id) values ('${d2}','${a1}','${u1}')`, ['23503']);
  await denied('cross-user application attachment blocked', `insert into public.document_attachments(document_id,application_id,user_id) values ('${d1}','${a2}','${u1}')`, ['23503']);
  await denied('cross-user letter application blocked', `insert into public.letter_drafts(user_id,scholarship_id,application_id,title) values ('${u1}','${s1}','${a2}','Bad')`, ['23503']);
  await denied('cross-scholarship letter application blocked', `insert into public.letter_drafts(user_id,scholarship_id,application_id,title) values ('${u1}','${s2}','${a1}','Bad')`, ['23503']);
  await denied('cross-user letter version blocked', `insert into public.letter_versions(letter_id,user_id,body) values ('${l1}','${u1}','Bad')`, ['23503']);
  await denied('cross-user conversation blocked', `insert into public.assistant_conversations(user_id,scholarship_id,application_id) values ('${u1}','${s1}','${a2}')`, ['23503']);
  await denied('cross-user message blocked', `insert into public.assistant_messages(conversation_id,user_id,role,content) values ('${c1}','${u1}','user','Bad')`, ['23503']);
  await denied('assistant impersonation blocked', `insert into public.assistant_messages(conversation_id,user_id,role,content) values ('${c1}','${u1}','assistant','Bad')`);
  await denied('SOP output cannot be forged', `insert into public.sop_reviews(user_id,scholarship_id,source,provider,feedback) values ('${u1}','${s1}','paste','ai','{}')`);
  for (const [table, column] of Object.entries({ matches:'total_score', cv_extractions:'structured_data',
    fetch_runs:'status', scholarship_sources:'name', admin_audit_logs:'action', reminder_deliveries:'status' })) {
    await denied(`${table} cannot be inserted from browser`, `insert into public.${table} default values`);
    await denied(`${table} cannot be updated from browser`, `update public.${table} set ${column} = ${column}`);
  }
  await denied('notification body immutable', `update public.notifications set body='fake' where id='${n1}'`);
  await denied('notification cannot be forged', `insert into public.notifications(user_id,kind,title,body) values ('${u1}','deadline','Fake','Fake')`);
  await ok('notification mark-read permitted', `update public.notifications set read=true where id='${n1}' returning read`, [{ read: true }]);
  await ok('no source operations visible to student', 'select count(*)::int as n from public.scholarship_sources', [{ n: 0 }]);
  await ok('own storage upload permitted', `insert into storage.objects(bucket_id,name) values ('documents','${u1}/second.pdf')`);
  await denied('cross-user storage upload denied', `insert into storage.objects(bucket_id,name) values ('documents','${u2}/stolen.pdf')`);
  await denied('storage move into another user denied', `update storage.objects set name='${u2}/moved.pdf' where name='${u1}/second.pdf'`);
  await denied('metadata cannot reference another user path', `insert into public.documents(user_id,kind,original_name,safe_name,mime_type,byte_size,storage_path)
    values ('${u1}','cv','x','x','application/pdf',10,'${u2}/another.pdf')`);
  await denied('metadata requires uploaded object', `insert into public.documents(user_id,kind,original_name,safe_name,mime_type,byte_size,storage_path)
    values ('${u1}','cv','x','x','application/pdf',10,'${u1}/missing.pdf')`);
  await ok('register own uploaded document', `insert into public.documents(user_id,kind,original_name,safe_name,mime_type,byte_size,storage_path)
    values ('${u1}','cv','second.pdf','second.pdf','application/pdf',10,'${u1}/second.pdf')`);
  await ok('own application task works', `insert into public.application_tasks(application_id,user_id,title) values ('${a1}','${u1}','Task')`);
  await ok('own document attachment works', `insert into public.document_attachments(document_id,application_id,user_id) values ('${d1}','${a1}','${u1}')`);
  await ok('join published community', `insert into public.community_memberships(user_id,scholarship_id,display_name) values ('${u1}','${s1}','Student')`);
  await denied('cannot join draft community', `insert into public.community_memberships(user_id,scholarship_id,display_name) values ('${u1}','${draft}','Student')`);
  await ok('community post in own membership', `insert into public.community_posts(id,user_id,scholarship_id,channel,body) values ('${uid(91)}','${u1}','${s1}','general','Hello')`);
  await denied('cannot post in unjoined community', `insert into public.community_posts(user_id,scholarship_id,channel,body) values ('${u1}','${s2}','general','Hello')`);
  await denied('cannot reply across channels', `insert into public.community_posts(user_id,scholarship_id,channel,body,parent_id) values ('${u1}','${s1}','tips','Hello','${uid(91)}')`, ['23503']);

  await as('authenticated', u2);
  await ok('other user cannot read match', 'select count(*)::int as n from public.matches', [{ n: 0 }]);
  await ok('other user cannot read extraction', 'select count(*)::int as n from public.cv_extractions', [{ n: 0 }]);
  await ok('other user cannot read first user documents', `select count(*)::int as n from public.documents where user_id='${u1}'`, [{ n: 0 }]);
  await ok('user can send own message', `insert into public.assistant_messages(conversation_id,user_id,role,content) values ('${c1}','${u2}','user','Hello')`);
  await ok('cannot enumerate other memberships', 'select count(*)::int as n from public.community_memberships', [{ n: 0 }]);
  await denied('cannot report invisible community post', `insert into public.community_reports(post_id,reporter_id,reason) values ('${uid(91)}','${u2}','Reason')`);
  await denied('user cannot modify message identity', `update public.assistant_messages set role='assistant' where user_id='${u2}'`);

  await as('authenticated', admin);
  await ok('admin sees draft listings', 'select count(*)::int as n from public.scholarships', [{ n: 3 }]);
  await ok('admin does not gain document access', 'select count(*)::int as n from public.documents', [{ n: 0 }]);
  await ok('admin does not gain profile access', 'select id from public.profiles', [{ id: admin }]);
  await denied('admin browser cannot change model output', 'update public.matches set total_score=100');
  await denied('admin browser cannot elevate roles', `update public.user_roles set role='admin' where user_id='${u1}'`);
  await ok('admin can edit directory', `update public.scholarships set title='Updated' where id='${s1}' returning title`, [{ title: 'Updated' }]);
  await denied('unreviewed scholarship cannot be published', `update public.scholarships set published=true where id='${draft}'`, ['23514']);
  await denied('admin cannot forge another history actor', `insert into public.scholarship_change_history(scholarship_id,changed_by,field_name) values ('${s1}','${u1}','title')`);

  await as('service_role');
  await ok('service role can calculate matches', `update public.matches set total_score=86 where id='${m1}' returning total_score::int as score`, [{ score: 86 }]);
  await denied('service still cannot reference another users CV extraction', `update public.matches set user_id='${u2}' where id='${m1}'`, ['23503']);
  await denied('ineligible result cannot have suitability score', `update public.matches set eligibility_status='ineligible' where id='${m1}'`, ['23514']);
  await denied('scores must be bounded', `update public.matches set total_score=101 where id='${m1}'`, ['23514']);
  await denied('score breakdown must be object', `update public.matches set score_breakdown='[]' where id='${m1}'`, ['23514']);
  await denied('completed extraction needs timestamps', `update public.cv_extractions set status='succeeded' where id='${e1}'`, ['23514']);
  await ok('service can record source', `insert into public.scholarship_sources(id,name,source_url,source_type) values ('${uid(101)}','Official','https://example.org/feed','official_site')`);
  await ok('service can record another source', `insert into public.scholarship_sources(id,name,source_url,source_type) values ('${uid(102)}','Other','https://example.org/other','api')`);
  await ok('service can track a fetch', `insert into public.fetch_runs(id,source_id,importer_version) values ('${uid(111)}','${uid(101)}','1')`);
  await denied('fetch completion needs finish timestamp', `update public.fetch_runs set status='succeeded' where id='${uid(111)}'`, ['23514']);
  await denied('source and run must agree', `update public.scholarships set source_id='${uid(102)}',last_fetch_run_id='${uid(111)}' where id='${s1}'`, ['23503']);
  await ok('service can link source provenance', `update public.scholarships set source_id='${uid(101)}',last_fetch_run_id='${uid(111)}',source_record_id='source-one' where id='${s1}'`);
  await ok('service can complete extraction', `update public.cv_extractions set status='succeeded',started_at=now(),completed_at=now(),structured_data='{"education":[]}' where id='${e1}'`);
  await ok('service can queue reminder', `insert into public.reminder_deliveries(user_id,application_id,scholarship_id,channel,status,deadline_at,reminder_days,scheduled_for)
    values ('${u1}','${a1}','${s1}','in_app','queued','2026-12-31',3,'2026-12-28')`);
  await denied('duplicate reminder blocked', `insert into public.reminder_deliveries(user_id,application_id,scholarship_id,channel,status,deadline_at,reminder_days,scheduled_for)
    values ('${u1}','${a1}','${s1}','in_app','queued','2026-12-31',3,'2026-12-28')`, ['23505']);
  await denied('cross-user reminder blocked', `insert into public.reminder_deliveries(user_id,application_id,scholarship_id,channel,status,deadline_at,reminder_days,scheduled_for)
    values ('${u2}','${a1}','${s1}','in_app','queued','2026-12-31',3,'2026-12-28')`, ['23503']);

  await as('postgres');
  checks += await validateScholarshipDetails(db);
  await ok('updated_at maintained by database', `select (updated_at > created_at) as touched from public.profiles where id='${u1}'`, [{ touched: true }]);
  await ok('foreign key columns all indexed', `select c.conname from pg_constraint c
    where c.contype='f' and c.connamespace='public'::regnamespace and not exists (
      select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
      and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
    )`, []);
  console.log(`PASS: ${checks} migration, RLS, privilege, ownership, constraint, Storage-policy and index checks.`);
  console.log((await db.query('select version()')).rows[0].version);
  return { checks };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/validate-database.mjs')) {
  let failed = false;
  try { await validate(); }
  catch (error) { console.error(`${error.code ?? ''} ${error.message}`); failed = true; }
  finally { await db.close(); }
  if (failed) process.exitCode = 1;
}
