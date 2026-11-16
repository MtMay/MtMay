# Wayjot Guard

Wayjot kodunu **kural kitapçığına** (güvenlik, gizlilik, saat dilimi, dil, erişilebilirlik, bağımlılık kuralları) göre otomatik tarayan araç. Bulguları sade Türkçe yazar: ne yanlış, neden önemli, nasıl düzelir.

- **Bağımlılık yok**: yalnız Node.js 20+ gerekir. Wayjot'a yeni paket eklemez.
- **Kodu değiştirmez**: yalnız okur ve rapor verir.
- **Kendi testleri var**: bilerek hatalı bir örnek projede her kuralı yakaladığı ve kurallara uygun projede yanlış alarm vermediği test edilir.

## Kullanım

```bash
# Wayjot klasöründe
node /yol/wayjot-guard/bin/wayjot-guard.mjs .

# CI için: P1 ve üstü bulguda başarısız ol, JSON çıktı
node wayjot-guard/bin/wayjot-guard.mjs . --fail-on P1 --json

# Bilinçli kabul edilen bir kuralı atla (nedenini PR'a yaz)
node wayjot-guard/bin/wayjot-guard.mjs . --ignore DV-11
```

Çıkış kodu: `0` temiz, `1` eşik üstü bulgu var, `2` klasör bulunamadı.

Aracın kendi testleri: `cd wayjot-guard && npm test`

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `bin/wayjot-guard.mjs` | Komut satırı |
| `src/rules/*.mjs` | Kurallar (aşağıdaki tablo) |
| `sablonlar/rls_attack.sql` | Veritabanı saldırı testi şablonu (pgTAP). `supabase/tests/` altına kopyala. RLS'i kapalı tablo, `search_path`'siz SECURITY DEFINER ve `security_invoker`'sız view'ı **çalışan veritabanında** da yakalar. |
| `sablonlar/guvenlik.test.ts` | Uygulama testi şablonu (vitest). Sahte bir "kanarya" PNR ile paylaşım kartı, kilit ekranı, bildirim ve Sentry'ye kişisel veri sızmadığını kanıtlar; deep link ve PDF/AI çıktısını dener. |
| `KONTROL-LISTESI.md` | Telefonda ve çalışan sunucuya karşı yapılacak testler (statik taramanın göremedikleri). |

## Kurallar

| ID | Öncelik | Kontrol |
|---|---|---|
| SB-01 | P0 | Tabloda RLS açık değil |
| SB-02 | P1 | Tablonun `rls_attack.sql` testi yok |
| SB-03 | P0 | SECURITY DEFINER fonksiyonda `search_path = ''` yok |
| SB-04 | P0 | Yazma/silme politikası `USING (true)` / `WITH CHECK (true)` |
| SB-05 | P2 | Okuma politikası herkese açık (yalnız referans veri için uygun) |
| SB-06 | P2 | Politika rol belirtmiyor (`TO authenticated`) |
| SB-07 | P1 | View `security_invoker = true` değil |
| SB-08 | P1 | Storage bucket public |
| EF-01 | P0 | Edge Function kod içinde kullanıcı doğrulamıyor |
| EF-02 | P1 | Girdi Zod `strict()` ile doğrulanmıyor |
| EF-03 | P0 | İstemci model / max_tokens / sağlayıcı seçebiliyor |
| EF-04 | P0 | İstemciden gelen URL fetch ediliyor (SSRF) |
| EF-05 | P1 | İstek gövdesi / PDF metni / PNR loglanıyor |
| EF-06 | P2 | Hata ayrıntısı istemciye dönüyor |
| EF-07 | P1 | Maliyetli uçta kota / devre kesici yok |
| EF-08..10 | P1–P2 | PDF: `%PDF-` kontrolü, şifreli/JS PDF reddi, işlem sonrası silme |
| EF-11 | P0 | LLM'e araç / web erişimi verilmiş (prompt injection) |
| EF-12 | P0 | Konum saklanıyor / loglanıyor |
| DV-01 | P0 | Gizli anahtar uygulama kodunda (`sb_secret_`, `service_role`, `sk-…`, özel anahtar) |
| DV-02 | P1 | `.env` `.gitignore`'da değil |
| DV-03 | P0 | `EXPO_PUBLIC_` ile gizli değer |
| DV-04 | P0 | PNR / token AsyncStorage'a şifresiz |
| DV-05 | P1 | PNR / token loglanıyor |
| DV-06..07 | P1 | Sentry `sendDefaultPii: false` ve maskeleme eksik |
| DV-08 | P0 | Paylaşım kartı / kilit ekranı / bildirim kodunda PNR, soyad, adres, barkod, koordinat |
| DV-09..10 | P1–P2 | Deep link parametreleri doğrulanmıyor / yan etki tetikliyor |
| DV-11 | P3 | Bileşende sabit renk (token yerine) |
| DV-12 | P1 | Bilet ekranında ekran görüntüsü koruması yok |
| DV-13 | P1 | "Verilerimi sil" SecureStore'u temizlemiyor |
| DV-14..15 | P0 | Şifresiz HTTP (Android cleartext, iOS ATS) |
| DV-16..17 | P1 | Gereksiz izin (hassas konum, arka plan konumu, galeri okuma…) |
| DV-18 | P1 | Android yedeklemesi kapalı değil |
| DP-01..03 | P1 | pnpm: `minimumReleaseAge`, `blockExoticSubdeps`, `strictDepBuilds` |
| DP-04..06 | P1 | GitHub Actions: SHA sabitleme, `permissions:`, `--frozen-lockfile` |
| DP-07 | P0 | `pull_request_target` |
| DP-08 | P0 | Yasaklı kao273183 test becerileri |
| Q-01 | P1 | tr / en anahtarları eşit değil |
| Q-02..03 | P2–P3 | Türkçe büyük/küçük harf ve sıralama |
| Q-04..05 | P1–P2 | Çekirdekte cihaz saat dilimi / gerçek saat kullanımı |
| Q-06 | P2 | Para ondalıklı sayıyla |
| Q-07 | P2 | Dokunulabilir öğede erişilebilirlik etiketi yok |

## Sınırlar

- Bu bir **statik tarama**dır, kalıp eşleştirir. Bir bulgu "buraya bak" demektir; kesin hüküm için kodu oku. Yanlış alarmı `--ignore` ile ve nedenini yazarak kapat.
- "Temiz" sonuç güvenli demek değildir. Raporun sonundaki **Kontrol edilemedi** satırı, bulunamayan alanları (ör. migration yoksa RLS hiç taranmamıştır) gösterir.
- Çalışan sunucu ve gerçek cihaz testleri için `sablonlar/` ve `KONTROL-LISTESI.md` kullanılır.
