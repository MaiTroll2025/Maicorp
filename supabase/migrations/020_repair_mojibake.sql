-- 020 Repair mojibake introduced by an incorrectly decoded UTF-8 seed.
-- Use code points instead of the corrupted glyphs so this migration stays ASCII-clean.
do $$
declare
  bad_em_dash text := chr(226) || chr(8364) || chr(8221);
  bad_en_dash text := chr(226) || chr(8364) || chr(8220);
begin
  update public.companies
  set tagline = replace(replace(tagline, bad_em_dash, '-'), bad_en_dash, '-'),
      description = replace(replace(description, bad_em_dash, '-'), bad_en_dash, '-');

  update public.products
  set name = replace(replace(name, bad_em_dash, '-'), bad_en_dash, '-'),
      description = replace(replace(description, bad_em_dash, '-'), bad_en_dash, '-'),
      estimated_delivery = replace(replace(estimated_delivery, bad_em_dash, '-'), bad_en_dash, '-'),
      features = replace(replace(features::text, bad_em_dash, '-'), bad_en_dash, '-')::jsonb;

  update public.platforms
  set name = replace(replace(name, bad_em_dash, '-'), bad_en_dash, '-'),
      description = replace(replace(description, bad_em_dash, '-'), bad_en_dash, '-');

  update public.page_content
  set value = replace(replace(value::text, bad_em_dash, '-'), bad_en_dash, '-')::jsonb;

  update public.announcements
  set title = replace(replace(title, bad_em_dash, '-'), bad_en_dash, '-'),
      body = replace(replace(body, bad_em_dash, '-'), bad_en_dash, '-');

    if to_regclass('public.platform_apps') is not null then
        update public.platform_apps
        set name = replace(replace(name, bad_em_dash, '-'), bad_en_dash, '-'),
                description = replace(replace(description, bad_em_dash, '-'), bad_en_dash, '-');
    end if;

    if to_regclass('public.app_updates') is not null then
        update public.app_updates
        set title = replace(replace(title, bad_em_dash, '-'), bad_en_dash, '-'),
                description = replace(replace(description, bad_em_dash, '-'), bad_en_dash, '-'),
                release_notes = replace(replace(release_notes, bad_em_dash, '-'), bad_en_dash, '-');
    end if;
end $$;
