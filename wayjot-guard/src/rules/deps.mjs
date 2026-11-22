import { matches } from '../files.mjs';

export default function deps(files, add) {
  const ws = files.find((f) => f.rel === 'pnpm-workspace.yaml');
  const npmrc = files.find((f) => f.rel === '.npmrc');
  const cfg = (ws?.text || '') + '\n' + (npmrc?.text || '');
  const pkg = files.find((f) => f.rel === 'package.json');
  if (pkg || ws) {
    const where = ws ? ws.rel : (npmrc ? npmrc.rel : 'pnpm-workspace.yaml');
    const age = cfg.match(/minimum-?ReleaseAge\s*[:=]\s*(\d+)/i);
    if (!age || Number(age[1]) < 10080) add('DP-01', 'P1', where, 1, `minimumReleaseAge ${age ? age[1] : 'yok'} (en az 10080 dk = 7 gün olmalı). Yeni yayımlanan zararlı sürümler hemen kurulabilir.`, '`minimumReleaseAge: 10080`');
    if (!/blockExoticSubdeps\s*[:=]\s*true/i.test(cfg)) add('DP-02', 'P1', where, 1, 'blockExoticSubdeps açık değil; alt bağımlılıklar git/tarball adreslerinden gelebilir.', '`blockExoticSubdeps: true`');
    if (!/strictDepBuilds\s*[:=]\s*true/i.test(cfg)) add('DP-03', 'P1', where, 1, 'strictDepBuilds açık değil; paketlerin kurulum betikleri izinsiz çalışabilir.', '`strictDepBuilds: true` + `allowBuilds` listesi.');
  }
  for (const f of files.filter((x) => /^\.github\/workflows\/.+\.ya?ml$/.test(x.rel))) {
    for (const { m, line } of matches(f, /uses:\s*([^\s#]+)/)) {
      const ref = m[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      if (!/@[0-9a-f]{40}$/.test(ref)) add('DP-04', 'P1', f.rel, line, `GitHub Action SHA ile sabitlenmemiş: \`${ref}\`. Etiket değiştirilirse CI'da yabancı kod çalışır.`, '`uses: sahip/aksiyon@<40 haneli SHA> # vX.Y`');
    }
    if (!/^permissions\s*:/m.test(f.text)) add('DP-05', 'P1', f.rel, 1, 'Workflow\'da üst düzey `permissions:` yok; token varsayılan geniş yetkiyle çalışır.', '`permissions: { contents: read }` ile başla, gerekeni ekle.');
    for (const { line } of matches(f, /pnpm\s+(?:i|install)\b(?![^\n]*--frozen-lockfile)/)) {
      add('DP-06', 'P1', f.rel, line, 'CI `--frozen-lockfile` olmadan kuruyor; lockfile dışı sürümler girebilir.', '`pnpm install --frozen-lockfile`');
    }
    for (const { line } of matches(f, /pull_request_target/)) {
      add('DP-07', 'P0', f.rel, line, '`pull_request_target` yabancı PR koduna sırlarla erişim verebilir.', 'Gerekmiyorsa `pull_request` kullan.');
    }
  }
  for (const f of files) {
    for (const { line } of matches(f, /kao273183/i)) {
      if (/\.md$/.test(f.rel)) continue;
      add('DP-08', 'P0', f.rel, line, 'kao273183 test becerileri (çift lisanslı) Wayjot\'ta kullanılmamalı.', 'Kaldır.');
    }
  }
}
