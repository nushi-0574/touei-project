alter table public.police_exam_results
  add column if not exists name text not null default '',
  add column if not exists exam_name text not null default '';

create or replace function public.lookup_police_exam_result(
  p_exam_number text,
  p_birth_date text
)
returns table (
  exam_number text,
  name text,
  exam_name text,
  result text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    result_row.exam_number::text,
    result_row.name::text,
    result_row.exam_name::text,
    result_row.result::text
  from public.police_exam_results as result_row
  where result_row.exam_number::text = p_exam_number
    and result_row.birth_date::text = p_birth_date
  limit 1;
$function$;

revoke all on function public.lookup_police_exam_result(text, text) from public;
grant execute on function public.lookup_police_exam_result(text, text) to anon, authenticated;

revoke select on table public.police_exam_results from public, anon;
