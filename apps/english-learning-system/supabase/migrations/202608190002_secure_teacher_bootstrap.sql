-- 首位及后续教师只能由 Admin API 写入 raw_app_meta_data.app_role 后创建。
-- 普通客户端无法修改 app_metadata，因此不能借此提升角色。
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  generated_code text;
  requested_role public.app_role;
begin
  requested_role := case
    when new.raw_app_meta_data ->> 'app_role' = 'teacher' then 'teacher'::public.app_role
    else 'student'::public.app_role
  end;
  generated_code := upper(coalesce(
    new.raw_user_meta_data ->> 'student_code',
    'S' || substring(replace(new.id::text, '-', '') from 1 for 8)
  ));
  if requested_role = 'teacher' then
    insert into public.profiles (id, role, display_name, student_code)
    values (new.id, 'teacher', coalesce(new.raw_user_meta_data ->> 'display_name', '老师'), null);
  else
    insert into public.profiles (id, role, display_name, student_code)
    values (
      new.id,
      'student',
      coalesce(new.raw_user_meta_data ->> 'display_name', generated_code),
      generated_code
    );
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
