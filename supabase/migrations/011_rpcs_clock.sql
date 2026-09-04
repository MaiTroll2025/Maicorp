-- 011 RPCs (time clock, breaks, timesheets)
create or replace function public.clock_in(p_employee_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_id uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.time_entries where employee_id = p_employee_id and status = 'OPEN') then
    raise exception 'Already clocked in';
  end if;

  insert into public.time_entries(employee_id, clock_in_at, status, source)
  values (p_employee_id, now(), 'OPEN', 'web')
  returning id into v_id;

  perform public.audit_log('CLOCK_IN', p_employee_id::text, 'OK');
  return v_id;
end;
$$;

create or replace function public.clock_out(p_employee_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.time_entries
    set clock_out_at = now(),
        status = 'CLOSED'
  where employee_id = p_employee_id and status = 'OPEN';
  if not found then raise exception 'No open clock-in'; end if;

  perform public.audit_log('CLOCK_OUT', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.start_break(p_employee_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_time_entry uuid; v_break uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;

  select id into v_time_entry from public.time_entries where employee_id = p_employee_id and status = 'OPEN' order by clock_in_at desc limit 1;
  if v_time_entry is null then raise exception 'No open clock-in'; end if;
  if exists (select 1 from public.break_entries where time_entry_id = v_time_entry and ended_at is null) then
    raise exception 'Break already active';
  end if;
  insert into public.break_entries(time_entry_id) values (v_time_entry) returning id into v_break;
  perform public.audit_log('BREAK_START', p_employee_id::text, 'OK');
  return v_break;
end;
$$;

create or replace function public.end_break(p_employee_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_time_entry uuid; v_break record;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;

  select te.id into v_time_entry from public.time_entries te where te.employee_id = p_employee_id and te.status = 'OPEN' order by te.clock_in_at desc limit 1;
  if v_time_entry is null then raise exception 'No open clock-in'; end if;

  select * into v_break from public.break_entries where time_entry_id = v_time_entry and ended_at is null order by started_at desc limit 1;
  if v_break.id is null then raise exception 'No active break'; end if;

  update public.break_entries set ended_at = now() where id = v_break.id;
  update public.time_entries
    set break_minutes = break_minutes + extract(epoch from (now() - v_break.started_at))/60.0
  where id = v_time_entry;

  perform public.audit_log('BREAK_END', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_emp uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select employee_id into v_emp from public.timesheets where id = p_timesheet_id;
  update public.timesheets set status = 'APPROVED', approved_by = v_uid, approved_at = now() where id = p_timesheet_id and status in ('SUBMITTED','REJECTED');
  perform public.audit_log('TIMESHEET_APPROVED', p_timesheet_id::text, 'OK');
end;
$$;

create or replace function public.reject_timesheet(p_timesheet_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.timesheets set status = 'REJECTED', approved_by = v_uid, approved_at = now(), notes = coalesce(notes,'') || ' | rejected: ' || coalesce(p_reason,'') where id = p_timesheet_id;
  perform public.audit_log('TIMESHEET_REJECTED', p_timesheet_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.submit_timesheet(p_timesheet_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_emp uuid; v_owner uuid;
begin
  select employee_id into v_emp from public.timesheets where id = p_timesheet_id;
  select user_id into v_owner from public.employees where id = v_emp;
  if v_owner <> v_uid then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.timesheets set status = 'SUBMITTED', submitted_at = now() where id = p_timesheet_id and status in ('DRAFT','REJECTED');
  perform public.audit_log('TIMESHEET_SUBMITTED', p_timesheet_id::text, 'OK');
end;
$$;