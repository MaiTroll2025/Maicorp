-- 010 RPCs (hiring, terminating, status changes, audit)
create or replace function public.audit_log(p_action text, p_target text, p_result text, p_reason text default null, p_metadata jsonb default null)
  returns void
  language sql
  security definer
  set search_path = public
  as $$
    insert into public.audit_logs(actor_id, action, target, result, reason, metadata)
    values (auth.uid(), p_action, p_target, p_result, p_reason, p_metadata);
  $$;

create or replace function public.bump_access_version(p_user_id uuid)
  returns void
  language sql
  security definer
  set search_path = public
  as $$
    update public.users set access_version = access_version + 1, updated_at = now() where id = p_user_id;
  $$;

create or replace function public.revoke_user_sessions(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
    begin
      -- Best effort: refresh_tokens rotated by bumping access_version;
      -- Supabase sessions are also invalidated by clearing metadata.
      update auth.users
        set banned_until = now() + interval '100 years',
            updated_at = now()
        where id = p_user_id and (banned_until is null or banned_until < now());
    exception when others then
      -- never break revocation flow
      null;
    end;
  $$;

create or replace function public.hire_employee(
  p_employee_id uuid,
  p_position_id uuid,
  p_department_id uuid,
  p_manager_id uuid,
  p_start_date date
)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.employees set
    position_id = p_position_id,
    department_id = p_department_id,
    manager_id = p_manager_id,
    start_date = coalesce(p_start_date, current_date),
    employment_status = 'ACTIVE',
    account_status = 'ACTIVE',
    updated_at = now()
  where id = p_employee_id;
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by)
    values (p_employee_id, p_position_id, p_department_id, p_manager_id, coalesce(p_start_date, current_date), 'HIRE', v_uid);
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, 'Hired');
  perform public.audit_log('EMPLOYEE_HIRED', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.terminate_employee(p_employee_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
declare
  v_uid uuid := auth.uid();
  v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;

  update public.employees set employment_status = 'TERMINATED', account_status = 'TERMINATED', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'TERMINATED', account_status = 'TERMINATED', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'TERMINATED', v_uid, p_reason);

  -- best-effort session invalidation
  perform public.revoke_user_sessions(v_user_id);

  perform public.audit_log('EMPLOYEE_TERMINATED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.suspend_employee(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;
  update public.employees set employment_status = 'SUSPENDED', account_status = 'DISABLED', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'SUSPENDED', account_status = 'DISABLED', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'SUSPENDED', v_uid, p_reason);
  perform public.revoke_user_sessions(v_user_id);
  perform public.audit_log('EMPLOYEE_SUSPENDED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.reactivate_employee(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;
  update public.employees set employment_status = 'ACTIVE', account_status = 'ACTIVE', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'ACTIVE', account_status = 'ACTIVE', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, p_reason);
  perform public.audit_log('EMPLOYEE_REACTIVATED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.promote_employee(p_employee_id uuid, p_position_id uuid, p_department_id uuid, p_manager_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  -- Preserve previous employment record
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by, reason)
    select employee_id, position_id, department_id, manager_id, current_date, 'PROMOTION', v_uid, p_reason
    from public.employees where id = p_employee_id;
  update public.employees set
    position_id = coalesce(p_position_id, position_id),
    department_id = coalesce(p_department_id, department_id),
    manager_id = coalesce(p_manager_id, manager_id),
    updated_at = now()
  where id = p_employee_id;
  perform public.audit_log('EMPLOYEE_PROMOTED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.transfer_employee(p_employee_id uuid, p_department_id uuid, p_manager_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by, reason)
    select employee_id, position_id, department_id, manager_id, current_date, 'TRANSFER', v_uid, p_reason
    from public.employees where id = p_employee_id;
  update public.employees set
    department_id = coalesce(p_department_id, department_id),
    manager_id = coalesce(p_manager_id, manager_id),
    updated_at = now()
  where id = p_employee_id;
  perform public.audit_log('EMPLOYEE_TRANSFERRED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.place_on_leave(p_employee_id uuid, p_expected_return date, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  update public.employees set employment_status = 'ON_LEAVE', updated_at = now() where id = p_employee_id;
  if v_user_id is not null then
    update public.users set employment_status = 'ON_LEAVE', updated_at = now() where id = v_user_id;
  end if;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ON_LEAVE', v_uid, coalesce(p_reason,'') || case when p_expected_return is not null then ' [expected return ' || p_expected_return::text || ']' else '' end);
  perform public.audit_log('EMPLOYEE_ON_LEAVE', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.return_from_leave(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  update public.employees set employment_status = 'ACTIVE', updated_at = now() where id = p_employee_id;
  if v_user_id is not null then
    update public.users set employment_status = 'ACTIVE', updated_at = now() where id = v_user_id;
  end if;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, 'Returned from leave');
  perform public.audit_log('EMPLOYEE_RETURNED', p_employee_id::text, 'OK', p_reason);
end;
$$;