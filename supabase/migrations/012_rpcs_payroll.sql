-- 012 RPCs (Payroll)
create or replace function public.calculate_payroll(p_period_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_period record;
  v_count int := 0;
  v_emp record;
  v_rate numeric;
  v_total_minutes int;
  v_overtime_minutes int;
  v_gross numeric;
  v_net numeric;
  v_rec record;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into v_period from public.payroll_periods where id = p_period_id;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if v_period.status not in ('OPEN','TIMESHEET_REVIEW') then
    raise exception 'Payroll period not open for calculation';
  end if;

  for v_emp in
    select e.id as employee_id
      from public.employees e
      where e.employment_status = 'ACTIVE'
  loop
    select coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 60.0), 0)
      into v_total_minutes
      from public.time_entries te
      where te.employee_id = v_emp.employee_id
        and te.status in ('CLOSED','CORRECTED')
        and te.clock_in_at >= v_period.starts_at
        and te.clock_in_at < v_period.ends_at + interval '1 day';

    v_total_minutes := v_total_minutes - coalesce((select sum(break_minutes) from public.time_entries where employee_id = v_emp.employee_id and clock_in_at >= v_period.starts_at and clock_in_at < v_period.ends_at + interval '1 day'), 0);
    v_total_minutes := greatest(v_total_minutes, 0);

    -- overtime beyond 40h/week standard (configurable, here per period)
    if v_total_minutes > 2400 then
      v_overtime_minutes := v_total_minutes - 2400;
      v_total_minutes := 2400;
    else
      v_overtime_minutes := 0;
    end if;

    select rate into v_rate from public.pay_rates where employee_id = v_emp.employee_id and effective_from <= v_period.ends_at order by effective_from desc limit 1;
    if v_rate is null then v_rate := 0; end if;

    v_gross := round((v_total_minutes / 60.0) * v_rate + (v_overtime_minutes / 60.0) * v_rate * 1.5, 2);
    -- placeholder deductions; configurable later
    v_net := v_gross;

    insert into public.payroll_records(period_id, employee_id, gross, net, regular_minutes, overtime_minutes, deductions_total, status)
      values (p_period_id, v_emp.employee_id, v_gross, v_net, v_total_minutes, v_overtime_minutes, 0, 'CALCULATED')
      on conflict (period_id, employee_id) do update set
        gross = excluded.gross,
        net = excluded.net,
        regular_minutes = excluded.regular_minutes,
        overtime_minutes = excluded.overtime_minutes
      returning id into v_rec;

    insert into public.payroll_items(record_id, kind, description, amount) values
      (v_rec.id, 'REGULAR', 'Regular hours', round((v_total_minutes/60.0)*v_rate, 2)),
      (v_rec.id, 'OVERTIME', 'Overtime hours', round((v_overtime_minutes/60.0)*v_rate*1.5, 2));

    v_count := v_count + 1;
  end loop;

  update public.payroll_periods set status = 'APPROVED' where id = p_period_id;
  perform public.audit_log('PAYROLL_CALCULATED', p_period_id::text, 'OK', null, jsonb_build_object('records', v_count));
  return v_count;
end;
$$;

create or replace function public.approve_payroll(p_period_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.payroll_records set status = 'APPROVED' where period_id = p_period_id;
  update public.payroll_periods set status = 'PROCESSED' where id = p_period_id;
  perform public.audit_log('PAYROLL_APPROVED', p_period_id::text, 'OK');
end;
$$;

create or replace function public.close_payroll(p_period_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.payroll_periods set status = 'LOCKED' where id = p_period_id;
  update public.payroll_records set status = 'LOCKED' where period_id = p_period_id;
  perform public.audit_log('PAYROLL_LOCKED', p_period_id::text, 'OK');
end;
$$;