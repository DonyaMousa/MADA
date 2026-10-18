-- Mada MVP consolidated initial migration for a project with no application tables.
-- Original source preserved byte-for-byte in supabase/reference/20261017120000_init.sql.
-- Do not apply alongside that reference file or to a database with the old schema.
begin;
set local search_path = public, extensions;

-- Mada initial schema. Lowercase identifiers, timestamptz, explicit grants, RLS on all exposed tables.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
-- Supabase defaults may otherwise silently re-grant broad API privileges.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.current_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Roles and profiles (authorization lives here, not in user_metadata)
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;


create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  citizenship text,
  residence_country text,
  current_degree text,
  institution text,
  field_of_study text,
  gpa numeric,
  gpa_scale numeric,
  graduation_year integer,
  intended_degree text check (intended_degree is null or intended_degree in ('masters', 'phd', 'either')),
  research_interests text,
  destination_preferences text[] not null default '{}',
  funding_need text check (funding_need is null or funding_need in ('full', 'partial', 'any')),
  language_tests jsonb not null default '[]'::jsonb,
  relevant_experience text,
  work_experience text,
  cv_extracted_suggestions jsonb,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  timezone text not null default 'Africa/Cairo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  upcoming_days integer not null default 14,
  due_soon_days integer not null default 3,
  timezone text not null default 'Africa/Cairo',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scholarships
-- ---------------------------------------------------------------------------

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  provider text not null,
  destination_countries text[] not null default '{}',
  supported_degrees text[] not null default '{}',
  fields text[] not null default '{}',
  funding_type text not null check (funding_type in ('full', 'partial', 'unknown')),
  covered_costs text[] not null default '{}',
  deadline_at timestamptz,
  deadline_timezone text,
  deadline_certainty text not null default 'unknown'
    check (deadline_certainty in ('confirmed', 'typical_cycle', 'unknown')),
  open_status text not null default 'unknown'
    check (open_status in ('open', 'closed', 'unknown')),
  eligibility_summary text not null,
  eligibility_rules jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  official_application_url text not null,
  official_source_url text not null,
  last_verified_at date,
  verification_state text not null default 'draft'
    check (verification_state in ('draft', 'in_review', 'verified', 'needs_review', 'archived')),
  data_label text not null default 'unverified_import',
  missing_data_notes text[] not null default '{}',
  retrieval_date date,
  source_url text not null,
  body_text text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scholarships_open_status_idx on public.scholarships (open_status);
create index scholarships_deadline_at_idx on public.scholarships (deadline_at);
create index scholarships_verification_state_idx on public.scholarships (verification_state);
create index scholarships_title_trgm_idx on public.scholarships using gin (title gin_trgm_ops);
create index scholarships_provider_trgm_idx on public.scholarships using gin (provider gin_trgm_ops);

create table public.scholarship_change_history (
  id bigint generated always as identity primary key,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  field_name text not null,
  old_value text,
  new_value text,
  source_url text,
  review_status text not null default 'recorded'
    check (review_status in ('recorded', 'needs_review', 'accepted'))
);

create index scholarship_change_history_scholarship_id_idx
  on public.scholarship_change_history (scholarship_id);

create table public.saved_scholarships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, scholarship_id)
);

create index saved_scholarships_scholarship_id_idx on public.saved_scholarships (scholarship_id);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete restrict,
  workspace_status text not null default 'saved'
    check (workspace_status in ('saved', 'preparing', 'submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  preparation_progress integer not null default 0,
  submitted_at timestamptz,
  confirmation_reference text,
  official_deadline_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scholarship_id)
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_scholarship_id_idx on public.applications (scholarship_id);

create table public.application_tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index application_tasks_application_id_idx on public.application_tasks (application_id, user_id);
create index application_tasks_user_id_idx on public.application_tasks (user_id);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'cv', 'transcript', 'certificate', 'language_result', 'recommendation', 'other'
  )),
  original_name text not null,
  safe_name text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_path text not null,
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents (user_id);

create table public.document_attachments (
  document_id uuid not null references public.documents (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, application_id)
);

create index document_attachments_application_id_idx on public.document_attachments (application_id, user_id);
create index document_attachments_user_id_idx on public.document_attachments (user_id);

-- ---------------------------------------------------------------------------
-- Letters
-- ---------------------------------------------------------------------------

create table public.letter_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index letter_drafts_user_id_idx on public.letter_drafts (user_id);
create index letter_drafts_scholarship_id_idx on public.letter_drafts (scholarship_id);

create table public.letter_versions (
  id bigint generated always as identity primary key,
  letter_id uuid not null references public.letter_drafts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  body text not null,
  created_at timestamptz not null default now()
);

create index letter_versions_letter_id_idx on public.letter_versions (letter_id, user_id);

create table public.sop_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  source text not null check (source in ('paste', 'file')),
  input_excerpt text,
  provider text not null check (provider in ('ai', 'unavailable', 'local_rules')),
  feedback jsonb not null,
  created_at timestamptz not null default now()
);

create index sop_reviews_user_id_idx on public.sop_reviews (user_id);

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  include_attachments boolean not null default false,
  created_at timestamptz not null default now()
);

create index assistant_conversations_user_id_idx on public.assistant_conversations (user_id);

create table public.assistant_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation_id_idx on public.assistant_messages (conversation_id, user_id);

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------

create table public.community_memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, scholarship_id)
);

create index community_memberships_scholarship_id_idx on public.community_memberships (scholarship_id);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  channel text not null check (channel in (
    'general', 'eligibility', 'documents_essays', 'deadlines', 'tips'
  )),
  body text not null,
  parent_id uuid references public.community_posts (id) on delete cascade,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_scholarship_channel_idx
  on public.community_posts (scholarship_id, channel, created_at desc);
create index community_posts_user_id_idx on public.community_posts (user_id);
create index community_posts_parent_id_idx on public.community_posts (parent_id, scholarship_id, channel);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create index community_reports_post_id_idx on public.community_reports (post_id);

create table public.community_rate_limits (
  user_id uuid not null,
  posted_at timestamptz not null default now()
);

create index community_rate_limits_user_posted_idx
  on public.community_rate_limits (user_id, posted_at desc);

-- ---------------------------------------------------------------------------
-- Notifications, content, admin
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

create table public.reminder_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  channel text not null check (channel in ('email', 'in_app')),
  status text not null check (status in ('queued', 'processing', 'sent', 'unconfigured', 'failed', 'cancelled')),
  detail text,
  created_at timestamptz not null default now()
);

create index reminder_deliveries_user_id_idx on public.reminder_deliveries (user_id);

create table public.provider_proposals (
  id uuid primary key default gen_random_uuid(),
  organization text not null,
  contact_email text not null,
  listing_title text not null,
  official_source_url text not null,
  notes text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'needs_info', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  kind text not null check (kind in ('help', 'guide', 'faq')),
  published boolean not null default true
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- MVP additions: import provenance, extracted CVs, reproducible recommendations
-- ---------------------------------------------------------------------------

create table public.scholarship_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  source_url text not null unique check (source_url ~ '^https?://[^[:space:]]+$'),
  source_type text not null check (source_type in ('official_site', 'api', 'manual')),
  enabled boolean not null default true,
  fetch_interval_hours integer not null default 24 check (fetch_interval_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.scholarship_sources (id) on delete restrict,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  http_status integer check (http_status between 100 and 599),
  importer_version text not null check (btrim(importer_version) <> ''),
  error_detail jsonb not null default '{}'::jsonb check (jsonb_typeof(error_detail) = 'object'),
  unique (id, source_id),
  check (finished_at is null or finished_at >= started_at),
  check ((status = 'running') = (finished_at is null)),
  check (imported_count + rejected_count <= fetched_count)
);
create index fetch_runs_source_started_idx on public.fetch_runs (source_id, started_at desc);
create index fetch_runs_running_idx on public.fetch_runs (started_at) where status = 'running';

alter table public.scholarships
  add column source_id uuid references public.scholarship_sources (id) on delete restrict,
  add column last_fetch_run_id uuid,
  add column source_record_id text,
  add column source_checked_at timestamptz,
  add constraint scholarships_fetch_source_fk foreign key (last_fetch_run_id, source_id)
    references public.fetch_runs (id, source_id) on delete restrict,
  add constraint scholarships_fetch_requires_source check (last_fetch_run_id is null or source_id is not null),
  add constraint scholarships_eligibility_json check (jsonb_typeof(eligibility_rules) = 'array'),
  add constraint scholarships_documents_json check (jsonb_typeof(required_documents) = 'array'),
  add constraint scholarships_nonempty_text check (btrim(title) <> '' and btrim(provider) <> '' and btrim(slug) <> ''),
  add constraint scholarships_application_http check (official_application_url ~ '^https?://[^[:space:]]+$'),
  add constraint scholarships_official_source_http check (official_source_url ~ '^https?://[^[:space:]]+$'),
  add constraint scholarships_source_http check (source_url ~ '^https?://[^[:space:]]+$'),
  add constraint scholarships_publication_review check (not published or (
    verification_state = 'verified' and last_verified_at is not null and data_label <> 'development_catalog_example'
  )),
  add constraint scholarships_confirmed_deadline check (deadline_certainty <> 'confirmed' or deadline_at is not null);
create unique index scholarships_source_record_idx on public.scholarships (source_id, source_record_id)
  where source_record_id is not null;
create index scholarships_fetch_run_idx on public.scholarships (last_fetch_run_id, source_id);
create index scholarships_destination_gin_idx on public.scholarships using gin (destination_countries);
create index scholarships_degrees_gin_idx on public.scholarships using gin (supported_degrees);
create index scholarships_fields_gin_idx on public.scholarships using gin (fields);
create index scholarships_directory_idx on public.scholarships (funding_type, open_status, deadline_at, id)
  where published;
-- 'simple' preserves searchable Arabic and English tokens without English stemming.
alter table public.scholarships add column search_vector tsvector generated always as (
  to_tsvector('simple'::regconfig,
    coalesce(title, '') || ' ' || coalesce(provider, '') || ' ' ||
    coalesce(eligibility_summary, '') || ' ' || coalesce(body_text, ''))
) stored;
create index scholarships_search_gin_idx on public.scholarships using gin (search_vector);

alter table public.documents
  add constraint documents_id_user_key unique (id, user_id),
  add constraint documents_storage_path_key unique (storage_path),
  add constraint documents_size_check check (byte_size between 1 and 10485760),
  add constraint documents_mime_check check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'
  )),
  add constraint documents_name_check check (btrim(original_name) <> '' and btrim(safe_name) <> ''),
  add constraint documents_private_path_check check (
    split_part(storage_path, '/', 1) = user_id::text
    and length(storage_path) > 37
    and storage_path !~ '(^|/)\.{1,2}(/|$)'
    and position(chr(92) in storage_path) = 0
  );

create table public.cv_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed')),
  structured_data jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_data) = 'object'),
  extracted_text text,
  confidence numeric check (confidence between 0 and 1),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  error_code text,
  model_provider text not null check (btrim(model_provider) <> ''),
  model_version text not null check (btrim(model_version) <> ''),
  extractor_version text not null check (btrim(extractor_version) <> ''),
  schema_version text not null check (btrim(schema_version) <> ''),
  input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade,
  check ((status in ('succeeded', 'failed')) = (completed_at is not null)),
  check (status not in ('processing', 'succeeded', 'failed') or started_at is not null),
  check (completed_at is null or completed_at >= started_at),
  check (status <> 'failed' or error_code is not null)
);
create index cv_extractions_document_idx on public.cv_extractions (document_id, user_id, created_at desc);
create index cv_extractions_owner_idx on public.cv_extractions (user_id, created_at desc);
create index cv_extractions_pending_idx on public.cv_extractions (created_at) where status = 'pending';

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  cv_extraction_id uuid,
  eligibility_status text not null check (eligibility_status in (
    'eligible', 'possibly_eligible', 'ineligible', 'insufficient_information'
  )),
  eligibility_results jsonb not null check (jsonb_typeof(eligibility_results) = 'array'),
  total_score numeric(5,2) check (total_score between 0 and 100),
  score_breakdown jsonb not null check (jsonb_typeof(score_breakdown) = 'object'),
  explanation jsonb not null check (jsonb_typeof(explanation) = 'object'),
  model_versions jsonb not null check (jsonb_typeof(model_versions) = 'object' and model_versions <> '{}'::jsonb),
  scorer_version text not null check (btrim(scorer_version) <> ''),
  eligibility_version text not null check (btrim(eligibility_version) <> ''),
  input_fingerprint text not null check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  profile_updated_at timestamptz not null,
  scholarship_updated_at timestamptz not null,
  calculated_at timestamptz not null default now(),
  unique (user_id, scholarship_id),
  foreign key (cv_extraction_id, user_id) references public.cv_extractions (id, user_id) on delete cascade,
  check ((eligibility_status = 'ineligible' and total_score is null)
      or (eligibility_status <> 'ineligible' and total_score is not null))
);
create index matches_rank_idx on public.matches (user_id, total_score desc nulls last, scholarship_id);
create index matches_scholarship_idx on public.matches (scholarship_id);
create index matches_cv_extraction_idx on public.matches (cv_extraction_id, user_id);

-- ---------------------------------------------------------------------------
-- Integrity for existing relationships and deadline delivery records
-- Composite FKs enforce ownership even for service-role writes that bypass RLS.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_gpa_check check (
    (gpa is null or (gpa >= 0 and gpa <> 'NaN'::numeric and gpa_scale is not null and gpa <= gpa_scale))
    and (gpa_scale is null or (gpa_scale > 0 and gpa_scale < 'Infinity'::numeric))
  ),
  add constraint profiles_graduation_year_check check (graduation_year between 1900 and 2200),
  add constraint profiles_languages_json check (jsonb_typeof(language_tests) = 'array'),
  add constraint profiles_cv_suggestions_json check (jsonb_typeof(cv_extracted_suggestions) = 'object');
alter table public.reminder_preferences add constraint reminder_days_check
  check (due_soon_days >= 0 and upcoming_days > due_soon_days and upcoming_days <= 365);
alter table public.applications
  add constraint applications_id_user_key unique (id, user_id),
  add constraint applications_id_user_scholarship_key unique (id, user_id, scholarship_id),
  add constraint applications_progress_check check (preparation_progress between 0 and 100);
alter table public.application_tasks add constraint application_tasks_owner_fk
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade;
alter table public.document_attachments
  add constraint document_attachments_document_owner_fk foreign key (document_id, user_id)
    references public.documents (id, user_id) on delete cascade,
  add constraint document_attachments_application_owner_fk foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade;
alter table public.letter_drafts
  add constraint letter_drafts_id_user_key unique (id, user_id),
  add constraint letter_drafts_application_owner_fk foreign key (application_id, user_id, scholarship_id)
    references public.applications (id, user_id, scholarship_id) on delete set null (application_id);
alter table public.letter_versions add constraint letter_versions_owner_fk
  foreign key (letter_id, user_id) references public.letter_drafts (id, user_id) on delete cascade;
alter table public.assistant_conversations
  add constraint assistant_conversations_id_user_key unique (id, user_id),
  add constraint assistant_conversations_application_owner_fk foreign key (application_id, user_id, scholarship_id)
    references public.applications (id, user_id, scholarship_id) on delete set null (application_id),
  add constraint assistant_conversations_attachments_context check (not include_attachments or application_id is not null);
alter table public.assistant_messages
  add constraint assistant_messages_owner_fk foreign key (conversation_id, user_id)
    references public.assistant_conversations (id, user_id) on delete cascade,
  add constraint assistant_messages_citations_json check (jsonb_typeof(citations) = 'array');
alter table public.sop_reviews add constraint sop_reviews_feedback_json check (jsonb_typeof(feedback) = 'object');
alter table public.community_posts
  add constraint community_posts_context_key unique (id, scholarship_id, channel),
  add constraint community_posts_parent_context_fk foreign key (parent_id, scholarship_id, channel)
    references public.community_posts (id, scholarship_id, channel) on delete cascade,
  add constraint community_posts_not_self_parent check (parent_id is null or parent_id <> id),
  add constraint community_posts_body_check check (length(btrim(body)) between 1 and 20000);
alter table public.community_reports add constraint community_reports_reason_check check (btrim(reason) <> '');
alter table public.community_rate_limits
  add column id bigint generated always as identity primary key,
  add constraint community_rate_limits_user_fk foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.notifications
  add column delivery_key text unique,
  add column scholarship_id uuid references public.scholarships (id) on delete cascade,
  add constraint notifications_payload_json check (jsonb_typeof(payload) = 'object');
create index notifications_scholarship_idx on public.notifications (scholarship_id);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where not read;

-- Keep existing sent/unconfigured/failed statuses and add queue metadata.
-- Queue states are included in the original status CHECK above.
alter table public.reminder_deliveries
  add column scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  add column deadline_at timestamptz not null,
  add column reminder_days integer not null check (reminder_days between 0 and 365),
  add column scheduled_for timestamptz not null,
  add column sent_at timestamptz,
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column next_attempt_at timestamptz,
  add constraint reminder_deliveries_owner_fk foreign key (application_id, user_id, scholarship_id)
    references public.applications (id, user_id, scholarship_id) on delete set null (application_id),
  add constraint reminder_deliveries_schedule_check check (scheduled_for <= deadline_at),
  add constraint reminder_deliveries_sent_check check ((status = 'sent') = (sent_at is not null)),
  add constraint reminder_deliveries_dedup_key unique (user_id, scholarship_id, channel, deadline_at, reminder_days);
create index reminder_deliveries_due_idx on public.reminder_deliveries (scheduled_for, next_attempt_at)
  where status in ('queued', 'failed');
create index reminder_deliveries_application_idx on public.reminder_deliveries (application_id, user_id, scholarship_id);
create index reminder_deliveries_scholarship_idx on public.reminder_deliveries (scholarship_id);
create index applications_active_deadline_idx on public.applications (official_deadline_at, user_id)
  where workspace_status in ('saved', 'preparing');
create index letter_drafts_application_idx on public.letter_drafts (application_id, user_id, scholarship_id);
create index letter_versions_user_idx on public.letter_versions (user_id);
create index document_attachments_document_owner_idx on public.document_attachments (document_id, user_id);
create index sop_reviews_scholarship_idx on public.sop_reviews (scholarship_id);
create index assistant_conversations_scholarship_idx on public.assistant_conversations (scholarship_id);
create index assistant_conversations_application_idx on public.assistant_conversations (application_id, user_id, scholarship_id);
create index assistant_messages_user_idx on public.assistant_messages (user_id);
create index community_reports_reporter_idx on public.community_reports (reporter_id);
create index scholarship_history_actor_idx on public.scholarship_change_history (changed_by);
create index admin_audit_actor_idx on public.admin_audit_logs (actor_id);

-- ---------------------------------------------------------------------------
-- Database-managed timestamps and CV type validation
-- ---------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'reminder_preferences', 'scholarships', 'applications', 'documents',
    'letter_drafts', 'community_posts', 'scholarship_sources', 'cv_extractions'
  ] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
  end loop;
end;
$$;

create function private.validate_cv_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.documents d
    where d.id = new.document_id and d.user_id = new.user_id and d.kind = 'cv') then
    raise exception 'CV extraction requires a CV document owned by the same user' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_cv_document() from public, anon, authenticated;
create trigger cv_document_check before insert or update on public.cv_extractions
  for each row execute function private.validate_cv_document();

-- Nulling an application reference must also revoke its document opt-in.
create function private.clear_attachment_opt_in() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.application_id is null then new.include_attachments := false; end if;
  return new;
end;
$$;
revoke all on function private.clear_attachment_opt_in() from public, anon, authenticated;
create trigger clear_attachment_opt_in before update on public.assistant_conversations
  for each row execute function private.clear_attachment_opt_in();

-- Timezone names are validated against PostgreSQL's IANA timezone catalog.
create function private.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_timezone() from public, anon, authenticated;
create trigger profiles_timezone_check before insert or update on public.profiles
  for each row execute function private.validate_timezone();
create trigger reminder_timezone_check before insert or update on public.reminder_preferences
  for each row execute function private.validate_timezone();

alter table public.matches enable row level security;
alter table public.cv_extractions enable row level security;
alter table public.scholarship_sources enable row level security;
alter table public.fetch_runs enable row level security;
create policy matches_owner_read on public.matches for select to authenticated
  using (user_id = (select auth.uid()));
create policy cv_extractions_owner_read on public.cv_extractions for select to authenticated
  using (user_id = (select auth.uid()));
create policy scholarship_sources_admin_read on public.scholarship_sources for select to authenticated
  using ((select private.is_admin()));
create policy fetch_runs_admin_read on public.fetch_runs for select to authenticated
  using ((select private.is_admin()));

comment on table public.matches is 'Latest service-calculated result per user/scholarship. No browser writes. Compare input versions before reuse; this is suitability, not acceptance probability.';
comment on column public.matches.score_breakdown is 'Versioned components with raw values, normalized scores, weights, and contributions. Must explain total_score.';
comment on column public.matches.eligibility_results is 'Per-rule pass/fail/unknown outcomes, source evidence, and missing inputs.';
comment on column public.matches.model_versions is 'Exact provider/model identifiers plus prompt/embedding versions as applicable.';
comment on column public.cv_extractions.structured_data is 'Versioned profile suggestions with provenance; user confirmation is required before applying to profile fields.';
comment on table public.fetch_runs is 'Service-managed import runs. Do not store credentials or student information in error_detail.';
comment on table public.reminder_deliveries is 'Delivery queue and idempotency ledger. A trusted worker must schedule/send/retry; the schema does not send notifications.';

-- ---------------------------------------------------------------------------
-- Auth trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  insert into public.user_roles (user_id, role)
  values (new.id, 'student');
  insert into public.reminder_preferences (user_id)
  values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.scholarships enable row level security;
alter table public.scholarship_change_history enable row level security;
alter table public.saved_scholarships enable row level security;
alter table public.applications enable row level security;
alter table public.application_tasks enable row level security;
alter table public.documents enable row level security;
alter table public.document_attachments enable row level security;
alter table public.letter_drafts enable row level security;
alter table public.letter_versions enable row level security;
alter table public.sop_reviews enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_rate_limits enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.provider_proposals enable row level security;
alter table public.contact_messages enable row level security;
alter table public.help_articles enable row level security;
alter table public.admin_audit_logs enable row level security;

alter table public.user_roles force row level security;
alter table public.profiles force row level security;
alter table public.documents force row level security;
alter table public.applications force row level security;

create policy user_roles_self_select on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy profiles_self_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_self_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy reminder_prefs_self on public.reminder_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy scholarships_public_read on public.scholarships
  for select to anon, authenticated
  using (published = true or (select private.is_admin()));

create policy scholarships_admin_write on public.scholarships
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy scholarship_history_read on public.scholarship_change_history
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.scholarships s
      where s.id = scholarship_id and (s.published = true or (select private.is_admin()))
    )
  );

create policy scholarship_history_admin_write on public.scholarship_change_history
  for insert to authenticated
  with check ((select private.is_admin()) and changed_by = (select auth.uid()));

create policy saved_scholarships_owner on public.saved_scholarships
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.scholarships s where s.id = scholarship_id and s.published
  ));

create policy applications_owner on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.scholarships s where s.id = scholarship_id and s.published
  ));

create policy application_tasks_owner on public.application_tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy documents_owner on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documents' and o.name = storage_path
      and (storage.foldername(o.name))[1] = (select auth.uid()::text)
  ));

create policy document_attachments_owner on public.document_attachments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy letter_drafts_owner on public.letter_drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.scholarships s where s.id = scholarship_id and s.published
  ));

create policy letter_versions_owner on public.letter_versions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy sop_reviews_owner on public.sop_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy assistant_conversations_owner on public.assistant_conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.scholarships s where s.id = scholarship_id and s.published
  ));

create policy assistant_messages_owner on public.assistant_messages
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy assistant_messages_user_insert on public.assistant_messages
  for insert to authenticated
  with check ((select auth.uid()) = user_id and role = 'user' and citations = '[]'::jsonb);

create policy community_memberships_read on public.community_memberships
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy community_memberships_self on public.community_memberships
  for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.scholarships s where s.id = scholarship_id and s.published
  ));

create policy community_memberships_delete_self on public.community_memberships
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy community_posts_read on public.community_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.community_memberships m
      where m.scholarship_id = community_posts.scholarship_id
        and m.user_id = (select auth.uid())
    )
  );

create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.community_memberships m
      where m.scholarship_id = community_posts.scholarship_id
        and m.user_id = (select auth.uid())
    )
  );

create policy community_posts_update_own on public.community_posts
  for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.community_memberships m
    where m.scholarship_id = community_posts.scholarship_id and m.user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.community_memberships m
    where m.scholarship_id = community_posts.scholarship_id and m.user_id = (select auth.uid())
  ));

create policy community_posts_delete_own on public.community_posts
  for delete to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy community_reports_insert on public.community_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id and exists (
    select 1 from public.community_posts p where p.id = post_id
  ));

create policy community_reports_admin_read on public.community_reports
  for select to authenticated
  using ((select private.is_admin()) or (select auth.uid()) = reporter_id);

create policy notifications_owner on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy reminder_deliveries_owner_select on public.reminder_deliveries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy provider_proposals_insert on public.provider_proposals
  for insert to anon, authenticated
  with check (status = 'pending_review');

create policy provider_proposals_admin on public.provider_proposals
  for select to authenticated
  using ((select private.is_admin()));

create policy provider_proposals_admin_update on public.provider_proposals
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy contact_messages_insert on public.contact_messages
  for insert to anon, authenticated
  with check (true);

create policy contact_messages_admin on public.contact_messages
  for select to authenticated
  using ((select private.is_admin()));

create policy help_articles_read on public.help_articles
  for select to anon, authenticated
  using (published = true or (select private.is_admin()));

create policy help_articles_admin on public.help_articles
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy admin_audit_admin on public.admin_audit_logs
  for select to authenticated
  using ((select private.is_admin()));

-- Storage object policies: folder 1 is the user id
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Explicit least-privilege grants also override existing Supabase defaults.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on function private.current_uid() from public, anon, authenticated;
revoke all on function public.handle_new_user() from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema private to service_role;

grant select on public.scholarships, public.scholarship_change_history, public.help_articles to anon, authenticated;
grant select on public.user_roles, public.profiles, public.reminder_preferences,
  public.saved_scholarships, public.applications, public.application_tasks,
  public.documents, public.document_attachments, public.letter_drafts,
  public.letter_versions, public.sop_reviews, public.assistant_conversations,
  public.assistant_messages, public.community_memberships, public.community_posts,
  public.community_reports, public.notifications, public.reminder_deliveries,
  public.provider_proposals, public.contact_messages, public.admin_audit_logs,
  public.matches, public.cv_extractions, public.scholarship_sources, public.fetch_runs to authenticated;

grant update (display_name, citizenship, residence_country, current_degree,
  institution, field_of_study, gpa, gpa_scale, graduation_year, intended_degree,
  research_interests, destination_preferences, funding_need, language_tests,
  relevant_experience, work_experience, locale, timezone) on public.profiles to authenticated;
grant insert (user_id, in_app, email, upcoming_days, due_soon_days, timezone),
  update (in_app, email, upcoming_days, due_soon_days, timezone)
  on public.reminder_preferences to authenticated;

grant insert (user_id, scholarship_id), delete on public.saved_scholarships to authenticated;
grant insert (id, user_id, scholarship_id, workspace_status, preparation_progress,
  submitted_at, confirmation_reference, notes),
  update (workspace_status, preparation_progress, submitted_at, confirmation_reference, notes),
  delete on public.applications to authenticated;
grant insert (id, application_id, user_id, title, done), update (title, done), delete
  on public.application_tasks to authenticated;
-- Upload to Storage first, then register its metadata. extracted_text is worker-owned.
grant insert (id, user_id, kind, original_name, safe_name, mime_type, byte_size, storage_path),
  update (original_name, safe_name), delete on public.documents to authenticated;
grant insert (document_id, application_id, user_id), delete on public.document_attachments to authenticated;
grant insert (id, user_id, scholarship_id, application_id, title, body),
  update (title, body), delete on public.letter_drafts to authenticated;
grant insert (letter_id, user_id, label, body), update (label), delete on public.letter_versions to authenticated;
grant usage on sequence public.letter_versions_id_seq to authenticated;
grant insert (id, user_id, scholarship_id, application_id, include_attachments),
  update (include_attachments), delete on public.assistant_conversations to authenticated;
grant insert (conversation_id, user_id, role, content) on public.assistant_messages to authenticated;
grant usage on sequence public.assistant_messages_id_seq to authenticated;
grant insert (user_id, scholarship_id, display_name), delete on public.community_memberships to authenticated;
grant insert (id, scholarship_id, user_id, channel, body, parent_id),
  update (body, deleted), delete on public.community_posts to authenticated;
grant insert (id, post_id, reporter_id, reason) on public.community_reports to authenticated;
grant update (read) on public.notifications to authenticated;

-- Listing/content editors are authorized separately by admin RLS; roles stay service-only.
grant insert, update, delete on public.scholarships, public.help_articles to authenticated;
grant insert (scholarship_id, changed_by, field_name, old_value, new_value, source_url, review_status)
  on public.scholarship_change_history to authenticated;
grant usage on sequence public.scholarship_change_history_id_seq to authenticated;
grant insert (organization, contact_email, listing_title, official_source_url, notes)
  on public.provider_proposals to anon, authenticated;
grant update (status) on public.provider_proposals to authenticated;
grant insert (name, email, topic, message) on public.contact_messages to anon, authenticated;

commit;
