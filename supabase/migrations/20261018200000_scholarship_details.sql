-- Additive scholarship detail schema. Keep every existing table and column.
-- Apply after 20261018171637_initial_mada_schema.sql. No remote deployment implied.
begin;
set local search_path = public, extensions;

alter table public.scholarships
  add column category text,
  add column description text,
  add column program_objectives text[] not null default '{}',
  add column eligible_academic_disciplines text[] not null default '{}',
  add column application_portals text[] not null default '{}',
  add column egypt_support_status text not null default 'needs_verification'
    check (egypt_support_status in ('supported_for_egypt', 'unsupported_for_egypt', 'needs_verification')),
  add column application_status text check (application_status in ('open', 'closed', 'upcoming', 'unknown')),
  add column application_status_evidence text,
  add column extraction_quality text check (extraction_quality in ('complete', 'partial', 'failed')),
  add column extracted_at timestamptz,
  add column latest_snapshot_id uuid,
  add constraint scholarships_id_source_key unique (id, source_id),
  add constraint scholarships_availability_consistent check (
    application_status is null or open_status = case when application_status = 'upcoming' then 'unknown' else application_status end
  );
create index scholarships_egypt_directory_idx on public.scholarships (egypt_support_status, deadline_at) where published;

-- Complete historical normalized records have their own audit home, not eligibility_rules.
-- Snapshot/evidence tables contain operational request metadata and are never public.
create table public.scholarship_snapshots (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  source_id uuid not null references public.scholarship_sources (id) on delete restrict,
  fetch_run_id uuid not null,
  provider_record_id text not null check (btrim(provider_record_id) <> ''),
  schema_version text not null check (btrim(schema_version) <> ''),
  extractor_version text not null check (btrim(extractor_version) <> ''),
  retrieved_at timestamptz not null,
  normalized_payload jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, scholarship_id),
  unique (scholarship_id, fetch_run_id, payload_sha256),
  foreign key (fetch_run_id, source_id) references public.fetch_runs (id, source_id) on delete restrict,
  foreign key (scholarship_id, source_id) references public.scholarships (id, source_id) on delete cascade
);
create index scholarship_snapshots_latest_idx on public.scholarship_snapshots (scholarship_id, retrieved_at desc);
create index scholarship_snapshots_run_idx on public.scholarship_snapshots (fetch_run_id, source_id);
create index scholarship_snapshots_source_idx on public.scholarship_snapshots (source_id);
create index scholarship_snapshots_parent_source_idx on public.scholarship_snapshots (scholarship_id, source_id);
alter table public.scholarships add constraint scholarships_latest_snapshot_fk
  foreign key (latest_snapshot_id, id) references public.scholarship_snapshots (id, scholarship_id)
  on delete set null (latest_snapshot_id) deferrable initially deferred;
create index scholarships_latest_snapshot_idx on public.scholarships (latest_snapshot_id, id);

create table public.scholarship_variants (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  applicant_status text not null check (btrim(applicant_status) <> ''),
  provider_status_value text,
  country_of_application text,
  provider_country_value text,
  country_semantics text not null,
  egypt_selectable boolean,
  egypt_support_status text not null check (egypt_support_status in ('supported_for_egypt', 'unsupported_for_egypt', 'needs_verification')),
  selection_confirmed boolean not null default false,
  procedure_loaded boolean not null default false,
  application_procedure text,
  application_status text not null default 'unknown' check (application_status in ('open', 'closed', 'upcoming', 'unknown')),
  application_status_evidence text,
  extraction_quality text not null check (extraction_quality in ('complete', 'partial', 'failed')),
  interaction_method text not null,
  country_options jsonb not null default '[]'::jsonb check (jsonb_typeof(country_options) = 'array'),
  status_options jsonb not null default '[]'::jsonb check (jsonb_typeof(status_options) = 'array'),
  evidence_urls text[] not null default '{}',
  error_detail text,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, scholarship_id),
  unique (scholarship_id, snapshot_id, applicant_status),
  foreign key (snapshot_id, scholarship_id) references public.scholarship_snapshots (id, scholarship_id) on delete cascade,
  check (not procedure_loaded or selection_confirmed),
  check (egypt_support_status <> 'supported_for_egypt' or (egypt_selectable is true and selection_confirmed and procedure_loaded))
);

create table public.scholarship_requirements (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  variant_id uuid,
  source_requirement_id text not null,
  category text not null,
  collections text[] not null default '{}',
  original_text text not null check (btrim(original_text) <> ''),
  normalized_meaning text not null,
  rule_type text not null check (rule_type in ('numeric', 'categorical', 'qualitative', 'conditional', 'descriptive')),
  requirement_strength text not null check (requirement_strength in ('mandatory', 'preferred', 'conditional', 'informational', 'uncertain')),
  operator text check (operator in ('>=', '>', '=', '<=', '<', 'in', 'not_in')),
  value jsonb,
  unit text,
  minimum_gpa numeric,
  gpa_scale numeric,
  academic_rank text,
  minimum_experience_months integer check (minimum_experience_months >= 0),
  maximum_years_since_graduation numeric check (maximum_years_since_graduation >= 0 and maximum_years_since_graduation < 'Infinity'::numeric),
  minimum_publications integer check (minimum_publications >= 0),
  is_hard_requirement boolean not null default false,
  conditions text[] not null default '{}',
  exceptions text[] not null default '{}',
  applicant_status text,
  country_of_application text,
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_section text not null,
  evidence_excerpt text not null,
  extraction_method text not null,
  interpretation_confidence numeric not null check (interpretation_confidence between 0 and 1),
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, scholarship_id),
  unique (snapshot_id, source_requirement_id),
  check (minimum_gpa is null or (minimum_gpa >= 0 and minimum_gpa <> 'NaN'::numeric and gpa_scale is not null and minimum_gpa <= gpa_scale)),
  check (gpa_scale is null or (gpa_scale > 0 and gpa_scale < 'Infinity'::numeric)),
  check (not is_hard_requirement or (not requires_human_review and requirement_strength = 'mandatory' and not ('selection_criteria' = any(collections))))
);

create table public.scholarship_language_requirements (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  variant_id uuid,
  language text not null check (btrim(language) <> ''),
  test_name text,
  minimum_score numeric check (minimum_score >= 0 and minimum_score < 'Infinity'::numeric),
  score_scale text,
  cefr_level text check (cefr_level ~ '^[ABC][12]$'),
  operator text check (operator in ('>=', '>', '=', '<=', '<')),
  requirement_stage text,
  alternative_group text,
  accepted boolean,
  certificate_max_age_months integer check (certificate_max_age_months >= 0),
  applicant_status text,
  country_of_application text,
  requirement_strength text not null check (requirement_strength in ('mandatory', 'preferred', 'conditional', 'informational', 'uncertain')),
  conditions text[] not null default '{}',
  exceptions text[] not null default '{}',
  original_text text not null check (btrim(original_text) <> ''),
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_section text not null,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  check (minimum_score is null or test_name is not null),
  check (accepted is distinct from false or (minimum_score is null and cefr_level is null))
);

create table public.scholarship_required_documents (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  variant_id uuid,
  name text not null check (btrim(name) <> ''),
  document_type text not null,
  mandatory boolean,
  conditions text[] not null default '{}',
  submission_stage text,
  required_format text,
  translation_requirements text,
  certification_requirements text,
  number_of_references integer check (number_of_references > 0),
  minimum_pages integer check (minimum_pages > 0),
  maximum_pages integer check (maximum_pages > 0),
  applicant_status text,
  instructions text not null,
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_section text not null,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  check (minimum_pages is null or maximum_pages is null or minimum_pages <= maximum_pages)
);

create table public.scholarship_deadlines (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  variant_id uuid,
  kind text not null check (kind in ('application', 'supporting_documents', 'portfolio', 'opening', 'intake', 'selection', 'scholarship_start', 'other')),
  date date,
  deadline_at timestamptz,
  timezone text,
  cycle_label text,
  year_explicit boolean not null default false,
  certainty text not null check (certainty in ('confirmed', 'typical_cycle', 'unknown')),
  applicant_status text,
  original_text text not null,
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_section text not null,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  check (certainty <> 'confirmed' or (date is not null and year_explicit)),
  check (deadline_at is null or (date is not null and timezone is not null and year_explicit))
);

create table public.scholarship_funding (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  variant_id uuid,
  benefit_type text not null,
  coverage text not null check (coverage in ('included', 'excluded', 'conditional', 'unknown')),
  amount numeric check (amount >= 0 and amount < 'Infinity'::numeric),
  currency text check (currency ~ '^[A-Z]{3}$'),
  payment_period text,
  duration_text text,
  applicant_status text,
  conditions text[] not null default '{}',
  original_text text not null,
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_section text not null,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  check (amount is null or currency is not null)
);

create table public.scholarship_evidence (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  snapshot_id uuid not null,
  url text not null check (url ~ '^https?://[^[:space:]]+$'),
  method text not null check (method in ('GET', 'POST', 'BROWSER_FORM')),
  retrieved_at timestamptz not null,
  status_code integer not null check (status_code between 100 and 599),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_type text,
  request_data jsonb check (jsonb_typeof(request_data) = 'object'),
  archive_storage_path text,
  created_at timestamptz not null default now(),
  foreign key (snapshot_id, scholarship_id) references public.scholarship_snapshots (id, scholarship_id) on delete cascade
);
create index scholarship_evidence_parent_idx on public.scholarship_evidence (scholarship_id);
create index scholarship_evidence_snapshot_idx on public.scholarship_evidence (snapshot_id, scholarship_id);
create index scholarship_evidence_hash_idx on public.scholarship_evidence (content_sha256);

-- Every child scope must agree with both the scholarship AND its exact snapshot.
-- This prevents cross-program and stale cross-snapshot links even for service writes.
alter table public.scholarship_variants add constraint scholarship_variants_snapshot_context_key unique (id, scholarship_id, snapshot_id);
do $$
declare table_name text;
begin
  foreach table_name in array array['scholarship_requirements', 'scholarship_language_requirements',
    'scholarship_required_documents', 'scholarship_deadlines', 'scholarship_funding'] loop
    execute format('alter table public.%I add constraint %I foreign key (snapshot_id, scholarship_id) references public.scholarship_snapshots (id, scholarship_id) on delete cascade', table_name, table_name || '_snapshot_fk');
    execute format('alter table public.%I add constraint %I foreign key (variant_id, scholarship_id, snapshot_id) references public.scholarship_variants (id, scholarship_id, snapshot_id) on delete cascade', table_name, table_name || '_variant_fk');
    execute format('create index %I on public.%I (snapshot_id, scholarship_id)', table_name || '_snapshot_idx', table_name);
    execute format('create index %I on public.%I (variant_id, scholarship_id, snapshot_id)', table_name || '_variant_idx', table_name);
    execute format('create index %I on public.%I (scholarship_id)', table_name || '_parent_idx', table_name);
  end loop;
end;
$$;
create index scholarship_variants_parent_idx on public.scholarship_variants (scholarship_id, egypt_support_status);
create index scholarship_variants_snapshot_idx on public.scholarship_variants (snapshot_id, scholarship_id);
create index scholarship_requirements_category_idx on public.scholarship_requirements (scholarship_id, category, requirement_strength);
create index scholarship_requirements_gpa_idx on public.scholarship_requirements (gpa_scale, minimum_gpa) where minimum_gpa is not null;
create index scholarship_languages_test_idx on public.scholarship_language_requirements (language, test_name, minimum_score);
create index scholarship_documents_type_idx on public.scholarship_required_documents (scholarship_id, document_type);
create index scholarship_deadlines_schedule_idx on public.scholarship_deadlines (deadline_at, scholarship_id) where deadline_at is not null;
create index scholarship_funding_benefit_idx on public.scholarship_funding (scholarship_id, benefit_type, coverage);
create trigger scholarship_deadlines_timezone_check before insert or update on public.scholarship_deadlines
  for each row when (new.timezone is not null) execute function private.validate_timezone();

-- New relations are service-written. Published, reviewed current details are public;
-- admins can inspect drafts, but their browser cannot forge imported detail rows.
do $$
declare table_name text;
begin
  foreach table_name in array array['scholarship_variants', 'scholarship_requirements',
    'scholarship_language_requirements', 'scholarship_required_documents', 'scholarship_deadlines', 'scholarship_funding'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    execute format('create policy %I on public.%I for select to anon, authenticated using ((select private.is_admin()) or (not requires_human_review and exists (select 1 from public.scholarships s where s.id = scholarship_id and s.published and s.latest_snapshot_id = snapshot_id)))', table_name || '_read', table_name);
  end loop;
  foreach table_name in array array['scholarship_snapshots', 'scholarship_evidence'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_admin()))', table_name || '_admin_read', table_name);
  end loop;
end;
$$;

-- Source snapshots and HTTP evidence are append-only through the service API.
revoke update, delete on public.scholarship_snapshots, public.scholarship_evidence from service_role;

create function private.touch_scholarship_details() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    update public.scholarships set updated_at = clock_timestamp()
      where id = old.scholarship_id and latest_snapshot_id = old.snapshot_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.scholarships set updated_at = clock_timestamp()
      where id = new.scholarship_id and latest_snapshot_id = new.snapshot_id;
  end if;
  return null;
end;
$$;
revoke all on function private.touch_scholarship_details() from public, anon, authenticated;
grant execute on function private.touch_scholarship_details() to service_role;
do $$
declare table_name text;
begin
  foreach table_name in array array['scholarship_variants', 'scholarship_requirements',
    'scholarship_language_requirements', 'scholarship_required_documents', 'scholarship_deadlines', 'scholarship_funding'] loop
    execute format('create trigger touch_scholarship_details after insert or update or delete on public.%I for each row execute function private.touch_scholarship_details()', table_name);
  end loop;
end;
$$;

-- Table-wide editor grants would otherwise cover every new service-owned column.
revoke insert, update on public.scholarships from authenticated;
grant insert (id, slug, title, provider, destination_countries, supported_degrees, fields,
  funding_type, covered_costs, deadline_at, deadline_timezone, deadline_certainty, open_status,
  eligibility_summary, eligibility_rules, required_documents, official_application_url,
  official_source_url, last_verified_at, verification_state, data_label, missing_data_notes,
  retrieval_date, source_url, body_text, published) on public.scholarships to authenticated;
grant update (slug, title, provider, destination_countries, supported_degrees, fields,
  funding_type, covered_costs, deadline_at, deadline_timezone, deadline_certainty, open_status,
  eligibility_summary, eligibility_rules, required_documents, official_application_url,
  official_source_url, last_verified_at, verification_state, data_label, missing_data_notes,
  retrieval_date, source_url, body_text, published) on public.scholarships to authenticated;

comment on table public.scholarship_snapshots is 'Historical full source extraction; admin/service read only. No source_context wrapper in eligibility_rules is needed for new payloads.';
comment on column public.scholarship_requirements.is_hard_requirement is 'False for automated extraction; a trusted review must explicitly approve executable hard eligibility. Selection criteria cannot be hard requirements.';
comment on column public.scholarship_language_requirements.alternative_group is 'Tests in the same group are accepted alternatives, not requirements to pass every test. Original conditions/stages remain authoritative.';
comment on column public.scholarship_deadlines.date is 'Published calendar date; midnight closing timestamps may fall on the next date. Missing years stay unknown.';
comment on column public.scholarship_evidence.archive_storage_path is 'Optional future archive object key; local filesystem paths and file bytes are not uploaded by the payload mapper.';
commit;
