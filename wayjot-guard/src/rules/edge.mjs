import { matches, isEdgeFn } from '../files.mjs';

const COSTLY = /anthropic|openai|generativelanguage|messages\.create|chat\.completions|pdf|llm|\bai\b/i;

export default function edge(files, add) {
  for (const f of files.filter((x) => isEdgeFn(x.rel))) {
    const t = f.text;
    const fn = f.rel.split('/').slice(-2, -1)[0];
    const authed = /getClaims\s*\(|auth\s*:\s*['"]user['"]|auth\.getUser\s*\(/.test(t);
    const signed = /webhook|signature|x-cron-secret|CRON_SECRET|timingSafeEqual/i.test(t);
    if (!authed && !signed) {
      add('EF-01', 'P0', f.rel, 1, `\`${fn}\` fonksiyonu kod içinde kullanıcı doğrulaması yapmıyor (verify_jwt'ye güvenmek yetmez).`, '`getClaims()` ya da `withSupabase({ auth: \'user\' })` ile `sub` zorunlu tut; cron/webhook ise imza/gizli anahtar kontrol et.');
    }
    if (!/\.strict\s*\(/.test(t)) {
      add('EF-02', 'P1', f.rel, 1, `\`${fn}\` girdisi Zod \`strict()\` ile doğrulanmıyor; beklenmeyen alanlar içeri sızabilir.`, 'İstek gövdesini `z.object({...}).strict().parse()` ile doğrula.');
    }
    for (const { m, line } of matches(f, /\b(?:body|input|payload|params|json|data|req\.body)\??\.(model|max_tokens|maxTokens|provider|temperature|system)\b/)) {
      add('EF-03', 'P0', f.rel, line, `İstemci \`${m[1]}\` değerini seçebiliyor; maliyet ve kötüye kullanım riski.`, 'Model/limit/sağlayıcıyı sunucuda sabitle; istemciden alma.');
    }
    for (const { m, line } of matches(f, /fetch\s*\(\s*(?:body|input|payload|params|data|json)\??\.\w+/)) {
      add('EF-04', 'P0', f.rel, line, `İstemciden gelen URL doğrudan fetch ediliyor (SSRF): \`${m[0]}\`.`, 'İzinli host listesi, her yönlendirmede yeniden kontrol, özel IP engeli, boyut ve zaman aşımı.');
    }
    for (const { line } of matches(f, /console\.(log|info|debug|error)\s*\([^)]*\b(body|req|request|pdfText|text|prompt|pnr)\b/i)) {
      add('EF-05', 'P1', f.rel, line, 'İstek gövdesi/PDF metni/PNR loglanıyor olabilir.', 'Gövdeyi loglama; yalnızca istek kimliği ve hata kodu yaz.');
    }
    for (const { line } of matches(f, /(?:error|err|e)\.(?:message|stack)\b[^\n]*(?:new\s+Response|json\s*\()|(?:new\s+Response|Response\.json)\s*\([^)]*(?:error|err)\.(?:message|stack)/)) {
      add('EF-06', 'P2', f.rel, line, 'Hata mesajı/stack istemciye dönüyor; iç yapı sızar.', 'İstemciye sabit hata kodu dön, ayrıntıyı sunucu loguna (PII\'siz) yaz.');
    }
    if (COSTLY.test(t + fn) && !/quota|kota|rate.?limit|daily.?cap|circuit|budget|limit_exceeded|usage_count/i.test(t)) {
      add('EF-07', 'P1', f.rel, 1, `\`${fn}\` maliyetli bir uç (AI/PDF) gibi görünüyor ama kota/devre kesici izi yok.`, 'Kullanıcı/cihaz başına sayaç + global günlük tavan + 503 devre kesici + sağlayıcı bütçe limiti.');
    }
    if (/pdf/i.test(t + fn)) {
      if (!/%PDF-/.test(t)) add('EF-08', 'P1', f.rel, 1, 'PDF işleniyor ama `%PDF-` imza baytı kontrolü görünmüyor.', 'MIME + `%PDF-` + ≤10 MB + ≤20 sayfa; şifreli ve JavaScript içeren PDF\'leri reddet.');
      if (!/\/Encrypt|\/JavaScript|\/JS\b|encrypted/i.test(t)) add('EF-09', 'P2', f.rel, 1, 'Şifreli/JavaScript içeren PDF reddi görünmüyor.', '`/Encrypt` ve `/JavaScript` işaretlerini ara, reddet.');
      if (!/\.remove\s*\(|deleteObject|\.delete\s*\(/.test(t)) add('EF-10', 'P1', f.rel, 1, 'İşlem sonrası PDF\'in depodan silindiği görünmüyor.', 'İşlem bitince dosyayı ve çıkarılan metni sil.');
    }
    if (/\btools\s*:\s*\[|tool_choice|web_search/i.test(t)) {
      add('EF-11', 'P0', f.rel, 1, 'LLM çağrısında araç/web erişimi var; PDF içeriğindeki talimat (prompt injection) araç çalıştırabilir.', 'PDF/AI modelinde tools, function call ve web erişimini kapat.');
    }
    for (const { line } of matches(f, /\b(?:lat|lng|latitude|longitude)\b[^\n]*(?:insert|upsert|console\.)/i)) {
      add('EF-12', 'P0', f.rel, line, 'Konum saklanıyor ya da loglanıyor olabilir.', 'Konumu ~1 km\'ye yuvarla, asla saklama/loglama.');
    }
  }
}
