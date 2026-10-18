import assert from 'node:assert/strict';

export async function validateScholarshipDetails(db) {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const source=id(700), run=id(701), published=id(702), draft=id(703), other=id(704);
  const snap=id(710), draftSnap=id(711), otherSnap=id(712), staleSnap=id(713);
  const variant=id(720), otherVariant=id(721), staleVariant=id(722);
  const req=id(730), staleReq=id(731), draftReq=id(732);
  let count = 0;
  async function role(name, user='') {
    await db.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub', '${user}', false)`);
  }
  async function check(label, sql, expected) {
    assert.deepEqual((await db.query(sql)).rows, expected, label); count++;
  }
  async function reject(label, action, code) {
    try { await action(); } catch (error) {
      assert.equal(error.code, code, `${label}: ${error.message}`); count++; return;
    }
    throw new Error(`${label}: unexpectedly allowed`);
  }
  async function insert(table, row) {
    const keys = Object.keys(row).map(k => `"${k}"`).join(',');
    await db.query(`insert into public.${table} (${keys}) select ${keys} from jsonb_populate_record(null::public.${table}, $1::jsonb)`, [JSON.stringify(row)]);
  }
  function requirement(overrides={}) {
    return {scholarship_id:published,snapshot_id:snap,variant_id:variant,source_requirement_id:crypto.randomUUID(),
      category:'academic_performance',original_text:'Excellent academic performance',normalized_meaning:'Excellent academic performance',
      rule_type:'qualitative',requirement_strength:'uncertain',source_url:'https://example.org/requirements',
      source_section:'Requirements',evidence_excerpt:'Excellent academic performance',extraction_method:'fixture',interpretation_confidence:0.5,...overrides};
  }
  await role('service_role');
  await insert('scholarship_sources',{id:source,name:'Detail fixture',source_url:'https://example.org/details',source_type:'official_site'});
  await insert('fetch_runs',{id:run,source_id:source,importer_version:'fixture'});
  for (const [scholarship, publish] of [[published,true],[draft,false],[other,true]]) {
    await insert('scholarships',{id:scholarship,slug:`details-${scholarship}`,title:'Details fixture',provider:'DAAD',funding_type:'unknown',
      eligibility_summary:'Review required',official_application_url:'https://example.org/app',official_source_url:'https://example.org',
      source_url:'https://example.org',source_id:source,published:publish,verification_state:publish?'verified':'draft',last_verified_at:publish?'2026-10-18':null});
  }
  for (const [snapshot, scholarship] of [[snap,published],[draftSnap,draft],[otherSnap,other],[staleSnap,published]]) {
    await insert('scholarship_snapshots',{id:snapshot,scholarship_id:scholarship,source_id:source,fetch_run_id:run,provider_record_id:scholarship,
      schema_version:'fixture',extractor_version:'fixture',retrieved_at:'2026-10-18T20:00:00Z',normalized_payload:{fixture:snapshot},payload_sha256:snapshot.replaceAll('-','').repeat(2)});
  }
  for (const [scholarship,snapshot] of [[published,snap],[draft,draftSnap],[other,otherSnap]]) {
    await db.query('update public.scholarships set latest_snapshot_id=$1 where id=$2',[snapshot,scholarship]);
  }
  for (const [v,s,snapshot] of [[variant,published,snap],[otherVariant,other,otherSnap],[staleVariant,published,staleSnap]]) {
    await insert('scholarship_variants',{id:v,scholarship_id:s,snapshot_id:snapshot,applicant_status:'Graduates',country_semantics:'residence/application',
      egypt_support_status:'needs_verification',extraction_quality:'partial',interaction_method:'fixture'});
  }
  await insert('scholarship_requirements',requirement({id:req}));
  await insert('scholarship_requirements',requirement({id:staleReq,snapshot_id:staleSnap,variant_id:staleVariant,requires_human_review:false}));
  await insert('scholarship_requirements',requirement({id:draftReq,scholarship_id:draft,snapshot_id:draftSnap,variant_id:null,requires_human_review:false}));
  await role('anon');
  await check('unreviewed, stale and draft-parent details are hidden', 'select id from public.scholarship_requirements', []);
  await reject('snapshot contents are not anonymous',()=>db.query('select * from public.scholarship_snapshots'),'42501');
  await reject('request metadata is not anonymous',()=>db.query('select * from public.scholarship_evidence'),'42501');

  await role('service_role');
  await db.exec(`update public.scholarship_requirements set requires_human_review=false where id='${req}'`);
  await role('anon');
  await check('only reviewed current published detail is public', 'select id from public.scholarship_requirements', [{id:req}]);
  await role('authenticated',id(1));
  await check('student cannot read snapshots', 'select id from public.scholarship_snapshots', []);
  await check('student cannot read request metadata', 'select id from public.scholarship_evidence', []);
  const tables={scholarship_snapshots:'schema_version',scholarship_variants:'applicant_status',scholarship_requirements:'category',
    scholarship_language_requirements:'language',scholarship_required_documents:'name',scholarship_deadlines:'original_text',
    scholarship_funding:'coverage',scholarship_evidence:'url'};
  for (const [table,column] of Object.entries(tables)) {
    await reject(`${table} browser insert`,()=>db.query(`insert into public.${table} default values`),'42501');
    await reject(`${table} browser update`,()=>db.query(`update public.${table} set ${column}=${column}`),'42501');
  }
  await role('authenticated',id(3));
  await check('admin can inspect all snapshots', 'select count(*)::int as n from public.scholarship_snapshots', [{n:4}]);
  await reject('admin browser cannot change imported requirement',()=>db.query(`update public.scholarship_requirements set minimum_gpa=4 where id='${req}'`),'42501');
  await reject('admin browser cannot forge country support',()=>db.query(`update public.scholarships set egypt_support_status='supported_for_egypt' where id='${published}'`),'42501');
  await role('service_role');
  await reject('snapshot is append-only',()=>db.query(`update public.scholarship_snapshots set schema_version='fake' where id='${snap}'`),'42501');
  await reject('wrong scholarship snapshot',()=>insert('scholarship_requirements',requirement({snapshot_id:otherSnap})),'23503');
  await reject('wrong scholarship variant',()=>insert('scholarship_requirements',requirement({variant_id:otherVariant})),'23503');
  await reject('same scholarship but wrong snapshot variant',()=>insert('scholarship_requirements',requirement({variant_id:staleVariant})),'23503');
  await reject('latest snapshot must belong to parent',()=>db.query(`update public.scholarships set latest_snapshot_id='${otherSnap}' where id='${published}'`),'23503');
  await reject('GPA cannot exceed scale',()=>insert('scholarship_requirements',requirement({minimum_gpa:5,gpa_scale:4})),'23514');
  await reject('unreviewed rule cannot become hard eligibility',()=>insert('scholarship_requirements',requirement({is_hard_requirement:true,requirement_strength:'mandatory'})),'23514');
  await reject('selection criterion cannot become hard eligibility',()=>insert('scholarship_requirements',requirement({is_hard_requirement:true,requires_human_review:false,requirement_strength:'mandatory',collections:['selection_criteria']})),'23514');
  await reject('score needs named test',()=>insert('scholarship_language_requirements',{scholarship_id:published,snapshot_id:snap,language:'English',minimum_score:6.5,requirement_strength:'mandatory',original_text:'test',source_url:'https://example.org',source_section:'Language'}),'23514');
  await reject('invalid CEFR is rejected',()=>insert('scholarship_language_requirements',{scholarship_id:published,snapshot_id:snap,language:'German',cefr_level:'B3',requirement_strength:'mandatory',original_text:'test',source_url:'https://example.org',source_section:'Language'}),'23514');
  await reject('document page bounds',()=>insert('scholarship_required_documents',{scholarship_id:published,snapshot_id:snap,name:'Letter',document_type:'motivation_letter',instructions:'test',minimum_pages:3,maximum_pages:2,source_url:'https://example.org',source_section:'Documents'}),'23514');
  await reject('confirmed deadline needs explicit year',()=>insert('scholarship_deadlines',{scholarship_id:published,snapshot_id:snap,kind:'application',certainty:'confirmed',original_text:'Annual',source_url:'https://example.org',source_section:'Deadline'}),'23514');
  await reject('funding amount needs currency',()=>insert('scholarship_funding',{scholarship_id:published,snapshot_id:snap,benefit_type:'stipend',coverage:'included',amount:1400,original_text:'test',source_url:'https://example.org',source_section:'Funding'}),'23514');
  await reject('deadline timezone must exist',()=>insert('scholarship_deadlines',{scholarship_id:published,snapshot_id:snap,kind:'application',certainty:'unknown',timezone:'Invalid/Zone',original_text:'Annual',source_url:'https://example.org',source_section:'Deadline'}),'23514');
  await reject('old and full availability must agree',()=>db.query(`update public.scholarships set application_status='upcoming',open_status='open' where id='${published}'`),'23514');
  await db.query(`update public.scholarships set application_status='upcoming',open_status='unknown' where id='${published}'`);
  await check('upcoming is preserved with compatibility status',`select application_status,open_status from public.scholarships where id='${published}'`,[{application_status:'upcoming',open_status:'unknown'}]);
  const before=(await db.query('select updated_at from public.scholarships where id=$1',[published])).rows[0].updated_at;
  await db.query('update public.scholarship_requirements set normalized_meaning=$1 where id=$2',['Updated',req]);
  const after=(await db.query('select updated_at from public.scholarships where id=$1',[published])).rows[0].updated_at;
  assert(new Date(after)>new Date(before),'detail changes invalidate parent revision');count++;
  await role('postgres');
  console.log(`PASS: ${count} additional scholarship-detail integrity and RLS checks.`);
  return count;
}
