-- Mada initial schema. Lowercase identifiers, timestamptz, explicit grants, RLS on all exposed tables.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists private;

revoke all on schema private from public;
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
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Roles and profiles (authorization lives here, not in user_metadata)
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

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
  data_label text not null default 'development_catalog_example',
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

create index application_tasks_application_id_idx on public.application_tasks (application_id);
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

create index document_attachments_application_id_idx on public.document_attachments (application_id);
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

create index letter_versions_letter_id_idx on public.letter_versions (letter_id);

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

create index assistant_messages_conversation_id_idx on public.assistant_messages (conversation_id);

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
create index community_posts_parent_id_idx on public.community_posts (parent_id);

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
  status text not null check (status in ('sent', 'unconfigured', 'failed')),
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

drop trigger if exists on_auth_user_created on auth.users;
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
on conflict (id) do nothing;

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
  using ((select auth.uid()) = id or (select private.is_admin()));

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
  with check ((select private.is_admin()));

create policy saved_scholarships_owner on public.saved_scholarships
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy applications_owner on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy application_tasks_owner on public.application_tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy documents_owner on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy document_attachments_owner on public.document_attachments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy letter_drafts_owner on public.letter_drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy letter_versions_owner on public.letter_versions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy sop_reviews_owner on public.sop_reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy assistant_conversations_owner on public.assistant_conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy assistant_messages_owner on public.assistant_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy community_memberships_read on public.community_memberships
  for select to authenticated
  using (true);

create policy community_memberships_self on public.community_memberships
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy community_posts_delete_own on public.community_posts
  for delete to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy community_reports_insert on public.community_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy community_reports_admin_read on public.community_reports
  for select to authenticated
  using ((select private.is_admin()) or (select auth.uid()) = reporter_id);

create policy notifications_owner on public.notifications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy reminder_deliveries_owner_select on public.reminder_deliveries
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy provider_proposals_insert on public.provider_proposals
  for insert to anon, authenticated
  with check (true);

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
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

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

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on public.scholarships, public.scholarship_change_history, public.help_articles to anon;
grant insert on public.provider_proposals, public.contact_messages to anon;
grant usage, select on all sequences in schema public to authenticated, service_role, anon;
