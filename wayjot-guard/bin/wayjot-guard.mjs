#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { scan } from '../src/guard.mjs';
import { toText } from '../src/report.mjs';

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`Kullanım: wayjot-guard [proje-klasörü] [--json] [--fail-on P0|P1|P2|P3] [--ignore ID,ID]
  --json       Sonucu JSON olarak yaz (CI için)
  --fail-on    Bu öncelik ve üstünde bulgu varsa çıkış kodu 1 (varsayılan: P0)
  --ignore     Bilinçli kabul edilen kuralları atla (ör. DV-11)`);
  process.exit(0);
}
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const root = resolve(args.find((a, i) => !a.startsWith('--') && !['--fail-on', '--ignore'].includes(args[i - 1])) || '.');
if (!existsSync(root)) { console.error(`Klasör yok: ${root}`); process.exit(2); }

const failOn = (opt('--fail-on') || 'P0').toUpperCase();
const result = scan(root, { ignore: (opt('--ignore') || '').split(',').filter(Boolean) });
console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : toText(result, root));
const limit = Number(failOn.slice(1));
process.exit(result.findings.some((f) => Number(f.severity.slice(1)) <= limit) ? 1 : 0);
