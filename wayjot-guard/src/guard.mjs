import { loadFiles } from './files.mjs';
import supabase from './rules/supabase.mjs';
import edge from './rules/edge.mjs';
import device from './rules/device.mjs';
import deps from './rules/deps.mjs';
import quality from './rules/quality.mjs';

export const RULES = [supabase, edge, device, deps, quality];
const ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function scan(root, { ignore = [] } = {}) {
  const files = loadFiles(root);
  const findings = [];
  const add = (id, severity, file, line, ne, cozum) => {
    if (!ignore.includes(id)) findings.push({ id, severity, file, line, ne, cozum });
  };
  for (const rule of RULES) rule(files, add);
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  return { files: files.length, findings, coverage: coverage(files) };
}

// Hangi alanların gerçekten tarandığını söyler: dosya yoksa "temiz" sanılmasın
function coverage(files) {
  const has = (re) => files.some((f) => re.test(f.rel));
  return {
    'Supabase migration': has(/supabase\/(migrations|schemas)\/.*\.sql$/),
    'RLS saldırı testi': has(/supabase\/tests\/rls_attack\.sql$/),
    'Edge Functions': has(/supabase\/functions\/[^/]+\/index\.[jt]s$/),
    'Expo yapılandırması': has(/(^|\/)app\.(json|config\.[jt]s)$/),
    'i18n (tr + en)': has(/i18n\/tr\.[jt]s$/) && has(/i18n\/en\.[jt]s$/),
    'pnpm ayarları': has(/^(pnpm-workspace\.yaml|\.npmrc)$/),
    'GitHub Actions': has(/^\.github\/workflows\//),
  };
}
