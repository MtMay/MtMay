import { matches, isMigration } from '../files.mjs';

const ident = (s) => s.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();

// CREATE FUNCTION ifadesinin tamamı: $tag$ gövdesini atlayıp ilk ';' ye kadar
function functionStatement(text, start) {
  let i = start;
  const open = /\$(\w*)\$/g;
  open.lastIndex = start;
  const semi = text.indexOf(';', start);
  const o = open.exec(text);
  if (o && (semi === -1 || o.index < semi)) {
    const close = text.indexOf(o[0], o.index + o[0].length);
    i = close === -1 ? text.length : close + o[0].length;
  }
  const end = text.indexOf(';', i);
  return text.slice(start, end === -1 ? text.length : end + 1);
}

export default function supabase(files, add) {
  const sql = files.filter((f) => isMigration(f.rel));
  const tables = new Map(); // ad -> {file, line}
  const rlsOn = new Set();

  for (const f of sql) {
    for (const { m, line } of matches(f, /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i)) {
      const name = ident(m[1]);
      if (!tables.has(name)) tables.set(name, { file: f.rel, line });
    }
    for (const { m } of matches(f, /alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/i)) rlsOn.add(ident(m[1]));

    // SECURITY DEFINER fonksiyon search_path = '' olmadan
    for (const { m, line } of matches(f, /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)/i)) {
      const body = functionStatement(f.text, m.index);
      if (/security\s+definer/i.test(body) && !/set\s+search_path\s*(=|to)\s*''/i.test(body)) {
        add('SB-03', 'P0', f.rel, line, `SECURITY DEFINER fonksiyon \`${ident(m[1])}\` search_path'i '' yapmıyor; şema ele geçirme ile yetki yükseltme mümkün.`, "Fonksiyona `SET search_path = ''` ekle, tablo adlarını `public.` ile yaz.");
      }
    }
    // USING (true) / WITH CHECK (true)
    for (const { m, line } of matches(f, /create\s+policy\s+("[^"]+"|\w+)\s+on\s+([\w."]+)([\s\S]*?);/i)) {
      const body = m[3];
      const cmd = (body.match(/\bfor\s+(all|select|insert|update|delete)\b/i)?.[1] || 'all').toLowerCase();
      const openUsing = /using\s*\(\s*true\s*\)/i.test(body);
      const openCheck = /with\s+check\s*\(\s*true\s*\)/i.test(body);
      if ((openUsing || openCheck) && cmd !== 'select') {
        add('SB-04', 'P0', f.rel, line, `\`${ident(m[2])}\` tablosunda ${cmd.toUpperCase()} politikası herkese açık (true). Herhangi bir kullanıcı başkasının verisini yazabilir/silebilir.`, '`trip_id in (select public.my_trip_ids(...))` koşulunu kullan.');
      } else if (openUsing && cmd === 'select') {
        add('SB-05', 'P2', f.rel, line, `\`${ident(m[2])}\` herkese okunabilir (USING true). Yalnızca herkese açık referans verisi için kabul edilir.`, 'Tablo kişisel veri içeriyorsa trip_id koşuluna çevir.');
      }
      if (!/\bto\s+authenticated\b/i.test(body) && !/\bto\s+anon\b/i.test(body) && cmd !== 'select' && !openUsing) {
        add('SB-06', 'P2', f.rel, line, `\`${ident(m[2])}\` politikası rol belirtmiyor (TO authenticated); anon rol de değerlendiriliyor.`, '`TO authenticated` ekle; anonim kullanıcıları `is_anonymous` ile ayır.');
      }
    }
    // View security_invoker olmadan
    for (const { m, line } of matches(f, /create\s+(?:or\s+replace\s+)?view\s+([\w."]+)([^;]*?)\bas\b/i)) {
      if (!/security_invoker\s*=\s*(true|on)/i.test(m[2])) {
        add('SB-07', 'P1', f.rel, line, `View \`${ident(m[1])}\` security_invoker olmadan tanımlı; view sahibi yetkisiyle çalışır ve RLS'i atlar.`, '`create view ... with (security_invoker = true) as ...`');
      }
    }
    // Storage: public bucket
    for (const { line } of matches(f, /insert\s+into\s+storage\.buckets[\s\S]*?\btrue\b/i)) {
      add('SB-08', 'P1', f.rel, line, 'Storage bucket public=true görünüyor; bilet PDF\'leri herkese açılabilir.', 'Bucket private olsun, ≤60 sn imzalı URL kullan, işlem sonrası sil.');
    }
  }

  const attack = files.find((f) => /supabase\/tests\/rls_attack\.sql$/.test(f.rel));
  for (const [name, at] of tables) {
    if (!rlsOn.has(name)) {
      add('SB-01', 'P0', at.file, at.line, `\`${name}\` tablosunda RLS açılmamış. Yayınlanabilir (publishable) anahtarla herkes bu tabloyu okuyabilir.`, `\`alter table public.${name} enable row level security;\` ve politika ekle.`);
    }
    if (sql.length && !(attack && new RegExp(`\\b${name}\\b`, 'i').test(attack.text))) {
      add('SB-02', 'P1', at.file, at.line, `\`${name}\` için supabase/tests/rls_attack.sql içinde saldırı testi yok.`, 'Şablon: wayjot-guard/sablonlar/rls_attack.sql — anon okuyamaz, A kullanıcısı B\'nin satırını okuyamaz/değiştiremez/silemez.');
    }
  }
}
