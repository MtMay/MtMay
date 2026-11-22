const LABEL = { P0: 'P0 · Mutlaka düzelt', P1: 'P1 · Düzeltilmeli', P2: 'P2 · Olsa iyi olur', P3: 'P3 · Görsel/küçük' };

export function toText({ files, findings, coverage }, root) {
  const out = [`Wayjot Guard raporu — ${root}`, `Taranan dosya: ${files}`, ''];
  const counts = Object.fromEntries(Object.keys(LABEL).map((k) => [k, findings.filter((f) => f.severity === k).length]));
  out.push(`Özet: P0 ${counts.P0} · P1 ${counts.P1} · P2 ${counts.P2} · P3 ${counts.P3}`, '');
  for (const sev of Object.keys(LABEL)) {
    const list = findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    out.push(`## ${LABEL[sev]}`);
    list.forEach((f, i) => out.push(`${i + 1}. [${f.id}] ${f.file}:${f.line}`, `   Ne: ${f.ne}`, `   Çözüm: ${f.cozum}`));
    out.push('');
  }
  const missing = Object.entries(coverage).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) out.push(`Kontrol edilemedi (dosya bulunamadı): ${missing.join(', ')}`);
  out.push('Not: Bu bir statik taramadır. Cihazda yapılacak testler için KONTROL-LISTESI.md\'ye bak.');
  out.push(counts.P0 ? `Karar: önce ${counts.P0} P0 bulguyu düzelt.` : counts.P1 ? 'Karar: P0 yok; P1 bulguları yayın öncesi kapat.' : 'Karar: Statik taramada engel yok.');
  return out.join('\n');
}
