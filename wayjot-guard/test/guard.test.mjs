import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scan } from '../src/guard.mjs';
import { i18nKeys } from '../src/rules/quality.mjs';

const fx = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const ids = (r) => new Set(r.findings.map((f) => f.id));

test('kurallara aykırı proje: her beklenen kural yakalanır', () => {
  const found = ids(scan(fx('kotu')));
  const expected = [
    'SB-01', 'SB-02', 'SB-03', 'SB-04', 'SB-07', 'SB-08',
    'EF-01', 'EF-02', 'EF-03', 'EF-04', 'EF-05', 'EF-07', 'EF-08', 'EF-09', 'EF-10', 'EF-11',
    'DV-01', 'DV-02', 'DV-03', 'DV-04', 'DV-05', 'DV-06', 'DV-07', 'DV-08', 'DV-09', 'DV-10',
    'DV-11', 'DV-12', 'DV-13', 'DV-14', 'DV-16', 'DV-17', 'DV-18',
    'DP-01', 'DP-02', 'DP-03', 'DP-04', 'DP-05', 'DP-06', 'DP-07',
    'Q-01', 'Q-02', 'Q-04', 'Q-05', 'Q-06', 'Q-07',
  ];
  const missing = expected.filter((id) => !found.has(id));
  assert.deepEqual(missing, [], `yakalanmayan kurallar: ${missing}`);
});

test('kurallara uygun proje: yanlış alarm yok (yalnız bilinçli referans tablo notu)', () => {
  const r = scan(fx('iyi'));
  assert.deepEqual(r.findings.map((f) => `${f.id} ${f.file}`), ['SB-05 supabase/migrations/001_init.sql']);
  assert.ok(Object.values(r.coverage).every(Boolean), 'tüm alanlar taranmalı');
});

test('--ignore ile bilinçli kabul edilen kural atlanır', () => {
  assert.equal(scan(fx('iyi'), { ignore: ['SB-05'] }).findings.length, 0);
});

test('i18n: iç içe anahtar, tırnaklı anahtar, fonksiyon değer, yorum ve dize içi iki nokta', () => {
  const keys = i18nKeys(`export const tr = {
    home: { title: 'Ana sayfa, hoş: geldin', 'sub-x': "a:b" }, // yorum: x
    count: (n: number) => \`\${n} gün\`,
    nested: { deep: { k: 'v' } },
    last: 'son'
  } as const;`);
  assert.deepEqual([...keys], ['home.title', 'home.sub-x', 'count', 'nested.deep.k', 'last']);
});

test('boş klasör: bulgu yok ama hiçbir alan "temiz" sayılmaz', () => {
  const r = scan(fx('iyi/packages'));
  assert.equal(r.findings.length, 0);
  assert.ok(Object.values(r.coverage).every((v) => v === false));
});
