import { matches, isAppCode } from '../files.mjs';

// tr.ts / en.ts içindeki iç içe anahtarları "a.b.c" olarak çıkarır (dizeleri ve yorumları atlar)
export function i18nKeys(text) {
  const keys = new Set();
  const stack = [];
  const skipStr = (i) => { const q = text[i]; let j = i + 1; while (j < text.length && text[j] !== q) j += text[j] === '\\' ? 2 : 1; return j; };
  const skipValue = (i) => { // değerin sonuna (seviye-0 ',' ya da '}') kadar ilerle
    let d = 0;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '"' || c === "'" || c === '`') i = skipStr(i);
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) { if (d === 0) return i - 1; d--; }
      else if (c === ',' && d === 0) return i;
    }
    return i;
  };
  let i = text.indexOf('{');
  if (i < 0) return keys;
  for (i++; i < text.length; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 1; continue; }
    if (c === '}') { if (!stack.length) break; stack.pop(); continue; }
    let key = null, end = i;
    if (c === '"' || c === "'") { end = skipStr(i); key = text.slice(i + 1, end); end++; }
    else if (/[A-Za-z_$]/.test(c) && !/[\w$.]/.test(text[i - 1])) { const id = text.slice(i).match(/^[\w$]+/)[0]; key = id; end = i + id.length; }
    if (key === null) continue;
    const colon = text.slice(end).match(/^\s*:\s*/);
    if (!colon) { i = end - 1; continue; }
    i = end + colon[0].length;
    if (text[i] === '{') { stack.push(key); continue; }
    keys.add([...stack, key].join('.'));
    i = skipValue(i);
  }
  return keys;
}

export default function quality(files, add) {
  const tr = files.find((f) => /i18n\/tr\.[jt]s$/.test(f.rel));
  const en = files.find((f) => /i18n\/en\.[jt]s$/.test(f.rel));
  if (tr && en) {
    const a = i18nKeys(tr.text), b = i18nKeys(en.text);
    const onlyTr = [...a].filter((k) => !b.has(k));
    const onlyEn = [...b].filter((k) => !a.has(k));
    if (onlyTr.length) add('Q-01', 'P1', en.rel, 1, `en'de eksik ${onlyTr.length} anahtar: ${onlyTr.slice(0, 8).join(', ')}${onlyTr.length > 8 ? '…' : ''}. İngilizce ekranda ham anahtar görünür.`, 'Anahtarları en dosyasına ekle.');
    if (onlyEn.length) add('Q-01', 'P1', tr.rel, 1, `tr'de eksik ${onlyEn.length} anahtar: ${onlyEn.slice(0, 8).join(', ')}${onlyEn.length > 8 ? '…' : ''}.`, 'Anahtarları tr dosyasına ekle.');
  }

  for (const f of files.filter((x) => isAppCode(x.rel))) {
    for (const { line } of matches(f, /\.to(?:Upper|Lower)Case\s*\(\s*\)/)) {
      add('Q-02', 'P2', f.rel, line, 'Dil belirtmeden büyük/küçük harf dönüşümü: "istanbul".toUpperCase() → "ISTANBUL" (doğrusu İSTANBUL).', "`toLocaleUpperCase('tr-TR')` ya da kullanıcı diline göre locale ver.");
      break;
    }
    for (const { line } of matches(f, /\.localeCompare\s*\(\s*[^,)]+\)/)) {
      add('Q-03', 'P3', f.rel, line, 'Dilsiz sıralama: Ç, Ğ, İ, Ö, Ş, Ü yanlış sıraya düşer.', "`new Intl.Collator('tr').compare` kullan.");
      break;
    }
    const core = /(^|\/)packages\/core\//.test(f.rel);
    if (core) {
      for (const { line } of matches(f, /getTimezoneOffset\s*\(|\.getHours\s*\(|\.setHours\s*\(/)) {
        add('Q-04', 'P1', f.rel, line, 'Çekirdek mantık cihazın saat dilimini kullanıyor; uçuşta telefon saat dilimi değişince yolculuk saatleri kayar.', 'Yolculuk-yerel dakika + IANA bölge ile hesapla (Intl.DateTimeFormat timeZone).');
        break;
      }
      for (const { line } of matches(f, /\bnew Date\(\s*\)|Date\.now\(\s*\)/)) {
        add('Q-05', 'P2', f.rel, line, 'Çekirdekte gerçek saat okunuyor; testler günün saatine göre farklı sonuç verebilir.', 'Saati parametre ya da Clock portu olarak içeri ver.');
        break;
      }
    }
    for (const { line } of matches(f, /\b(parseFloat|toFixed\s*\(\s*2\s*\))[^\n]*(price|amount|tutar|fiyat|cost|money)|(price|amount|tutar|fiyat|cost)\w*\s*[*/+-]=?\s*\d*\.\d+/i)) {
      add('Q-06', 'P2', f.rel, line, 'Para ondalıklı sayıyla hesaplanıyor (0.1 + 0.2 ≠ 0.3).', 'Tam sayı alt birim (kuruş/cent) + ISO para birimi kullan.');
      break;
    }
    for (const { line } of matches(f, /<(Pressable|TouchableOpacity|TouchableHighlight)\b(?![^>]*accessibilityLabel)(?![^>]*accessibilityRole)[^>]*>/)) {
      add('Q-07', 'P2', f.rel, line, 'Dokunulabilir öğede erişilebilirlik etiketi/rolü yok; VoiceOver/TalkBack "düğme" diye okur.', '`accessibilityRole="button"` ve i18n\'den `accessibilityLabel` ekle.');
      break;
    }
  }
}
