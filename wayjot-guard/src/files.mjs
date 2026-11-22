import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.expo', 'coverage', 'ios', 'android', '.turbo', 'wayjot-guard']);
const TEXT = /\.(m?[jt]sx?|cjs|json|ya?ml|sql|toml|plist|xml|gradle|properties|md|env.*|npmrc)$|(^|\/)\.env[^/]*$|(^|\/)\.(npmrc|gitignore)$/;
const MAX = 1_000_000; // 1 MB üstü dosyalar (paketlenmiş çıktı vb.) atlanır

export function loadFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else {
        const rel = relative(root, abs).split(sep).join('/');
        if (TEXT.test(rel) && st.size <= MAX) out.push({ rel, text: readFileSync(abs, 'utf8') });
      }
    }
  };
  walk(root);
  return out;
}

export const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Yorum satırlarını eşleşmelerden çıkarmak için basit kontrol
export function isComment(text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const head = text.slice(start, index).trimStart();
  return head.startsWith('//') || head.startsWith('--') || head.startsWith('#') || head.startsWith('*');
}

export function* matches(file, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const m of file.text.matchAll(g)) {
    if (!isComment(file.text, m.index)) yield { m, line: lineOf(file.text, m.index) };
  }
}

export const isAppCode = (rel) => /\.(m?[jt]sx?)$/.test(rel) && !/(^|\/)supabase\/functions\//.test(rel) && !/(\.test|\.spec)\.[jt]sx?$|(^|\/)(__tests__|tests?)\//.test(rel);
export const isEdgeFn = (rel) => /(^|\/)supabase\/functions\/(?!_shared\/)[^/]+\/index\.[jt]s$/.test(rel);
export const isMigration = (rel) => /(^|\/)supabase\/(migrations|schemas)\/.*\.sql$/.test(rel);
