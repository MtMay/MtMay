-- Wayjot RLS saldırı testleri (pgTAP). Yeri: supabase/tests/rls_attack.sql
-- Çalıştırma: pnpm test:db  (ya da: supabase test db)
-- Her yeni tablo için "TABLO EKLE" bloklarını çoğalt.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 1) Genel: public şemasında RLS'i kapalı tablo kalmamalı (yeni tablo unutulursa yakalar)
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '{}'::text[],
  'public şemasında RLS kapalı tablo yok'
);

-- 2) Genel: SECURITY DEFINER fonksiyonların hepsi search_path = '' kullanmalı
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)),
  '{}'::text[],
  'SECURITY DEFINER fonksiyonların hepsinde search_path boş'
);

-- 3) Genel: view'lar security_invoker ile çalışmalı
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  '{}'::text[],
  'view''ların hepsi security_invoker = true'
);

-- Test kullanıcıları: A ve B (sahte kimlikler)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.invalid');

-- TABLO EKLE: B'ye ait bir satır (kolonları kendi şemana göre düzelt)
insert into public.trips (id, owner) values
  ('11111111-1111-1111-1111-11111111111b', '00000000-0000-0000-0000-00000000000b');

-- 4) anon hiçbir şey okuyamaz
set local role anon;
select is((select count(*) from public.trips), 0::bigint, 'anon trips okuyamaz');
reset role;

-- A olarak giriş yap
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 5) A, B'nin satırını okuyamaz
select is((select count(*) from public.trips where id = '11111111-1111-1111-1111-11111111111b'), 0::bigint, 'A, B''nin yolculuğunu göremez');

-- 6) A, B'nin satırını güncelleyemez (RLS sessizce 0 satır günceller)
update public.trips set owner = '00000000-0000-0000-0000-00000000000a' where id = '11111111-1111-1111-1111-11111111111b';
-- 7) A, B'nin satırını silemez
delete from public.trips where id = '11111111-1111-1111-1111-11111111111b';
reset role;
select is((select owner from public.trips where id = '11111111-1111-1111-1111-11111111111b'),
          '00000000-0000-0000-0000-00000000000b'::uuid, 'A, B''nin yolculuğunu değiştiremez');
select is((select count(*) from public.trips where id = '11111111-1111-1111-1111-11111111111b'), 1::bigint, 'A, B''nin yolculuğunu silemez');

-- 8) A, B adına satır ekleyemez
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.trips (id, owner) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'A, B adına yolculuk ekleyemez'
);

-- 9) Anonim (misafir) oturum kalıcı/paylaşımlı veriye yazamaz (kuralınız farklıysa uyarla)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.trips), 0::bigint, 'anonim oturum başkasının verisini göremez');
reset role;

select * from finish();
rollback;
