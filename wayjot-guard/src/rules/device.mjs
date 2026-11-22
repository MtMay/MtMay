import { matches, isAppCode } from '../files.mjs';

const SENSITIVE = /\b(pnr|surname|lastName|soyad|ticketCode|ticket_code|bookingRef|booking_ref|barcode|passport|pasaport|address|adres|latitude|longitude|coords|lat|lng)\b/i;
// Paylaşım kartı, kilit ekranı, bildirim: yalnızca güvenli alanlar olmalı
const OUTBOUND_FILE = /(share|memory|shareable|live.?activit|live.?status|liveSnapshot|lockscreen|lock.?screen|notification|widget|bildirim)/i;

export default function device(files, add) {
  const app = files.filter((f) => isAppCode(f.rel));
  const all = app.map((f) => f.text).join('\n');

  for (const f of files) {
    // Sırlar: uygulama kodunda/ortam dosyalarında
    const appOrEnv = isAppCode(f.rel) || /(^|\/)(app\.json|app\.config\.[jt]s|eas\.json)$/.test(f.rel) || /(^|\/)\.env/.test(f.rel);
    if (appOrEnv) {
      for (const { m, line } of matches(f, /sb_secret_[\w-]+|service_role|SUPABASE_SERVICE_ROLE|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-ant-[\w-]{10,}|\bsk-(?:proj-)?[A-Za-z0-9]{20,}/)) {
        add('DV-01', 'P0', f.rel, line, `Gizli anahtar istemci tarafında: \`${m[0].slice(0, 18)}…\`. Uygulama paketinden herkes okuyabilir.`, 'Anahtarı Edge Function secrets\'a taşı ve anahtarı hemen yenile (rotate).');
      }
    }
    if (/(^|\/)\.env/.test(f.rel) && !/\.example$|\.sample$/.test(f.rel)) {
      const gi = files.find((x) => x.rel === '.gitignore');
      if (!gi || !/^\.env/m.test(gi.text)) add('DV-02', 'P1', f.rel, 1, '`.env` dosyası var ama .gitignore\'da değil; depoya girebilir.', '.gitignore\'a `.env*` ekle (`!.env.example` hariç).');
    }
    for (const { m, line } of matches(f, /EXPO_PUBLIC_\w*(SECRET|SERVICE|PRIVATE|PASSWORD|ANTHROPIC|OPENAI)\w*/)) {
      add('DV-03', 'P0', f.rel, line, `\`${m[0]}\`: EXPO_PUBLIC_ değişkenleri uygulama paketine gömülür, gizli olamaz.`, 'Gizli değeri sunucuya taşı; istemcide yalnız `sb_publishable_…` kalsın.');
    }
  }

  for (const f of app) {
    for (const { m, line } of matches(f, /AsyncStorage\.(?:setItem|multiSet)\s*\(\s*[^,]*?(pnr|token|surname|ticket|passport|secret|key|trip|booking|session)/i)) {
      add('DV-04', 'P0', f.rel, line, `Hassas veri (\`${m[1]}\`) AsyncStorage'a şifresiz yazılıyor.`, 'Anahtar/token: expo-secure-store. Yolculuk/PNR: şifreli yerel veritabanı (anahtar SecureStore\'da).');
    }
    for (const { line } of matches(f, /console\.(log|info|debug|warn)\s*\([^)]*\b(pnr|surname|ticket|pdfText|passport|token)\b/i)) {
      add('DV-05', 'P1', f.rel, line, 'PNR/bilet/token loglanıyor; cihaz loglarından ve Sentry kırıntılarından sızar.', 'Bu logu kaldır.');
    }
    if (/Sentry\.init\s*\(/.test(f.text)) {
      const at = f.text.search(/Sentry\.init\s*\(/);
      const line = f.text.slice(0, at).split('\n').length;
      if (!/sendDefaultPii\s*:\s*false/.test(f.text)) add('DV-06', 'P1', f.rel, line, 'Sentry `sendDefaultPii: false` değil.', '`sendDefaultPii: false` ekle.');
      if (!/beforeSend\s*[:(]/.test(f.text) || !/beforeBreadcrumb\s*[:(]/.test(f.text)) add('DV-07', 'P1', f.rel, line, 'Sentry\'de `beforeSend`/`beforeBreadcrumb` maskelemesi eksik.', 'Rota parametreleri, PNR, e-posta ve telefon kalıplarını maskele (şablon: sablonlar/guvenlik.test.ts).');
    }
    if (OUTBOUND_FILE.test(f.rel)) {
      for (const { m, line } of matches(f, SENSITIVE)) {
        add('DV-08', 'P0', f.rel, line, `Paylaşım/kilit ekranı/bildirim kodunda hassas alan geçiyor: \`${m[1]}\`. Karta veya kilit ekranına PNR, soyad, adres, barkod ya da koordinat düşmemeli.`, 'Ayrı `ShareableMemory` / kilit ekranı tipi kullan (yalnız uçuş/kapı/saat); sahte PNR ile test yaz.');
        break; // dosya başına bir uyarı yeter
      }
    }
    // Deep link: parametre doğrulamasız
    if (/useLocalSearchParams|useGlobalSearchParams|Linking\.(?:getInitialURL|addEventListener|parse)|useURL\s*\(/.test(f.text) && !/\.(safeParse|parse)\s*\(/.test(f.text.replace(/Linking\.parse/g, ''))) {
      add('DV-09', 'P1', f.rel, 1, 'Deep link / rota parametreleri Zod ile doğrulanmadan kullanılıyor.', 'Parametreleri `z.object({...}).strict().safeParse()` ile doğrula.');
    }
    if (/(useLocalSearchParams|Linking\.)/.test(f.text) && /\b(delete|remove|redeem|share|sil)\w*\s*\(/i.test(f.text) && /useEffect\s*\(/.test(f.text)) {
      add('DV-10', 'P2', f.rel, 1, 'Deep link açılışında yan etkili işlem (sil/paylaş/ödül) tetikleniyor olabilir.', 'Deep link yalnız ekran açsın; işlem kullanıcı dokunuşuyla olsun.');
    }
    for (const { m, line } of matches(f, /(['"])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1/)) {
      if (/(^|\/)(tokens?|theme)/i.test(f.rel)) break;
      add('DV-11', 'P3', f.rel, line, `Bileşende sabit renk: ${m[0]}. Koyu modda kontrast bozulur.`, 'Rengi tokens.json\'a ekle, `useTheme` ile kullan.');
      break;
    }
  }

  // Ekran görüntüsü koruması
  const pnrScreen = app.find((f) => /(pnr|ticket|bilet|boarding)/i.test(f.rel) && /\.(tsx|jsx)$/.test(f.rel));
  if (pnrScreen && !/expo-screen-capture|preventScreenCapture|usePreventScreenCapture/.test(all)) {
    add('DV-12', 'P1', pnrScreen.rel, 1, 'PNR/bilet ekranı var ama ekran görüntüsü koruması ve uygulama değiştirici örtüsü yok.', '`expo-screen-capture` ile `usePreventScreenCapture()` + arka plana geçerken örtü.');
  }
  // "Verilerimi sil" SecureStore'u da temizlemeli (iOS Keychain kaldırmada silinmez)
  if (/expo-secure-store/.test(all) && !/deleteItemAsync/.test(all)) {
    add('DV-13', 'P1', app.find((f) => /expo-secure-store/.test(f.text)).rel, 1, 'SecureStore kullanılıyor ama hiçbir yerde `deleteItemAsync` yok; "Verilerimi sil" sonrası Keychain\'de anahtar kalır.', 'Silme akışında tüm SecureStore anahtarlarını açıkça sil.');
  }

  // app.json / app.config
  for (const f of files.filter((x) => /(^|\/)app\.(json|config\.[jt]s)$/.test(x.rel))) {
    const t = f.text;
    const L = (re) => { const i = t.search(re); return i < 0 ? 1 : t.slice(0, i).split('\n').length; };
    if (/usesCleartextTraffic["']?\s*:\s*true/.test(t)) add('DV-14', 'P0', f.rel, L(/usesCleartextTraffic/), 'Android şifresiz HTTP trafiğine izin veriyor.', '`usesCleartextTraffic` kaldır (sürüm derlemesinde false).');
    if (/NSAllowsArbitraryLoads["']?\s*:\s*true/.test(t)) add('DV-15', 'P0', f.rel, L(/NSAllowsArbitraryLoads/), 'iOS ATS kapalı (NSAllowsArbitraryLoads).', 'Kaldır.');
    // Yalnız istenen izin listesi (blockedPermissions hariç)
    const requested = t.match(/(?<![A-Za-z])["']?permissions["']?\s*:\s*\[([^\]]*)\]/)?.[1] || '';
    for (const perm of ['ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'READ_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_CONTACTS', 'RECORD_AUDIO', 'CAMERA']) {
      if (new RegExp(`["'](android\\.permission\\.)?${perm}["']`).test(requested)) {
        add('DV-16', 'P1', f.rel, L(new RegExp(perm)), `Gereksiz izin: ${perm}. Kural: yalnız ön planda yaklaşık konum, galeriye yalnız yazma.`, '`android.permissions` listesinden çıkar ya da `blockedPermissions`\'a ekle.');
      }
    }
    if (/NSLocationAlways\w*UsageDescription/.test(t)) add('DV-17', 'P1', f.rel, L(/NSLocationAlways/), 'iOS "her zaman konum" izni isteniyor.', 'Yalnız `NSLocationWhenInUseUsageDescription` kalsın.');
    if (/["']?android["']?\s*:/.test(t) && !/allowBackup["']?\s*:\s*false/.test(t) && !/dataExtractionRules|fullBackupContent/.test(t)) {
      add('DV-18', 'P1', f.rel, 1, 'Android yedekleme kapatılmamış; yolculuk veritabanı Google yedeğine gidebilir.', '`android.allowBackup: false` ya da veritabanını yedekten hariç tutan kural (config plugin).');
    }
  }
}
