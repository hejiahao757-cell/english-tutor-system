-- 英语学习系统：第一版云端数据结构
-- 在 Supabase SQL Editor 中执行。所有公开表均启用 RLS。

create extension if not exists pgcrypto;

create type public.app_role as enum ('teacher', 'student');
create type public.content_kind as enum ('exam', 'dictation', 'knowledge');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  student_code text unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_code_by_role check (
    (role = 'student' and student_code is not null) or
    (role = 'teacher' and student_code is null)
  )
);

create table public.teacher_student_links (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null,
  kind public.content_kind not null,
  subtype text not null default '',
  units text not null default '',
  current_version integer not null default 1,
  published boolean not null default false,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  checksum text,
  manifest jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (content_id, version)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  student_id uuid not null references public.profiles(id),
  content_id uuid not null references public.content_items(id),
  analysis_policy text not null default 'teacher_only'
    check (analysis_policy in ('teacher_only','after_submit','scheduled','manual')),
  analysis_opens_at timestamptz,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  archived_at timestamptz,
  unique (student_id, content_id)
);

create table public.student_states (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null default 1,
  state jsonb not null default '{}'::jsonb,
  device_id text,
  updated_at timestamptz not null default now(),
  unique (student_id, content_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  content_id uuid not null references public.content_items(id),
  attempt integer not null default 1,
  answers jsonb not null,
  score numeric,
  teacher_comment text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (student_id, content_id, attempt)
);

create table public.vocabulary_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  word text not null,
  translation text not null default '',
  source_content_id uuid references public.content_items(id),
  legacy_source_id text,
  details jsonb not null default '{}'::jsonb,
  mastery smallint not null default 0 check (mastery between 0 and 5),
  next_review_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, word)
);

create table public.user_app_states (
  student_id uuid not null references public.profiles(id) on delete cascade,
  state_key text not null,
  state jsonb not null default '{}'::jsonb,
  device_id text,
  updated_at timestamptz not null default now(),
  primary key (student_id, state_key)
);

create table public.activity_events (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  event_type text not null,
  content_id uuid references public.content_items(id),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  device_id text not null,
  payload jsonb not null default '{}'::jsonb
);
create index activity_events_user_time_idx on public.activity_events (user_id, occurred_at desc);
create index activity_events_content_idx on public.activity_events (content_id, occurred_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  generated_code text;
begin
  generated_code := upper(coalesce(
    new.raw_user_meta_data ->> 'student_code',
    'S' || substring(replace(new.id::text, '-', '') from 1 for 8)
  ));
  insert into public.profiles (id, role, display_name, student_code)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data ->> 'display_name', generated_code),
    generated_code
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = auth.uid() and role = 'teacher' and archived_at is null
) $$;

create or replace function public.is_teacher_of(target_student uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.teacher_student_links
  where teacher_id = auth.uid() and student_id = target_student
) $$;

create or replace function public.link_student_by_code(requested_code text)
returns table (id uuid, display_name text, student_code text)
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
begin
  if not public.is_teacher() then
    raise exception 'teacher role required';
  end if;
  select p.id into target_id
  from public.profiles p
  where p.role = 'student'
    and p.archived_at is null
    and p.student_code = upper(trim(requested_code));
  if target_id is null then
    raise exception 'student code not found';
  end if;
  insert into public.teacher_student_links (teacher_id, student_id)
  values (auth.uid(), target_id)
  on conflict do nothing;
  return query
    select p.id, p.display_name, p.student_code
    from public.profiles p where p.id = target_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.teacher_student_links enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.assignments enable row level security;
alter table public.student_states enable row level security;
alter table public.submissions enable row level security;
alter table public.vocabulary_cards enable row level security;
alter table public.user_app_states enable row level security;
alter table public.activity_events enable row level security;

create policy "profile self or teacher" on public.profiles for select using (id = auth.uid() or public.is_teacher_of(id));
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "teacher sees links" on public.teacher_student_links for select using (teacher_id = auth.uid() or student_id = auth.uid());
create policy "teacher manages links" on public.teacher_student_links for all using (public.is_teacher() and teacher_id = auth.uid()) with check (public.is_teacher() and teacher_id = auth.uid());
create policy "published content visible" on public.content_items for select using ((published = true and deleted_at is null) or owner_id = auth.uid());
create policy "teacher owns content" on public.content_items for all using (public.is_teacher() and owner_id = auth.uid()) with check (public.is_teacher() and owner_id = auth.uid());
create policy "visible content versions" on public.content_versions for select using (exists (select 1 from public.content_items c where c.id = content_id and (c.published or c.owner_id = auth.uid())));
create policy "teacher writes versions" on public.content_versions for insert with check (public.is_teacher() and created_by = auth.uid());
create policy "assignment participants read" on public.assignments for select using (teacher_id = auth.uid() or student_id = auth.uid());
create policy "teacher manages assignments" on public.assignments for all using (public.is_teacher() and teacher_id = auth.uid()) with check (public.is_teacher() and teacher_id = auth.uid());
create policy "state student or teacher reads" on public.student_states for select using (student_id = auth.uid() or public.is_teacher_of(student_id));
create policy "student writes own state" on public.student_states for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "submission participants read" on public.submissions for select using (student_id = auth.uid() or public.is_teacher_of(student_id));
create policy "student submits" on public.submissions for insert with check (student_id = auth.uid());
create policy "teacher grades" on public.submissions for update using (public.is_teacher_of(student_id));
create policy "cards student or teacher reads" on public.vocabulary_cards for select using (student_id = auth.uid() or public.is_teacher_of(student_id));
create policy "student manages cards" on public.vocabulary_cards for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "state owner or teacher reads" on public.user_app_states for select using (student_id = auth.uid() or public.is_teacher_of(student_id));
create policy "student manages app state" on public.user_app_states for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "events student or teacher reads" on public.activity_events for select using (user_id = auth.uid() or public.is_teacher_of(user_id));
create policy "user appends events" on public.activity_events for insert with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-packages', 'content-packages', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "authenticated reads published packages"
on storage.objects for select to authenticated
using (bucket_id = 'content-packages' and (public.is_teacher() or name like 'published/%'));

create policy "teachers upload packages"
on storage.objects for insert to authenticated
with check (bucket_id = 'content-packages' and public.is_teacher());

create policy "teachers update packages"
on storage.objects for update to authenticated
using (bucket_id = 'content-packages' and public.is_teacher())
with check (bucket_id = 'content-packages' and public.is_teacher());

create policy "teachers delete packages"
on storage.objects for delete to authenticated
using (bucket_id = 'content-packages' and public.is_teacher());

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant usage on type public.app_role, public.content_kind to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.teacher_student_links to authenticated;
grant select, insert, update on public.content_items to authenticated;
grant select, insert on public.content_versions to authenticated;
grant select, insert, update on public.assignments to authenticated;
grant select, insert, update on public.student_states to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select, insert, update on public.vocabulary_cards to authenticated;
grant select, insert, update on public.user_app_states to authenticated;
grant select, insert on public.activity_events to authenticated;
grant execute on function public.is_teacher(), public.is_teacher_of(uuid), public.link_student_by_code(text) to authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- 安全原则：activity_events 只允许追加，不开放 update/delete；
-- 内容删除通过 deleted_at 进入回收站，服务端计划任务 30 天后再清理文件。
