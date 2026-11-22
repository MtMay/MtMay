// Wayjot güvenlik testleri (vitest). Yeri: apps/mobile/src/__tests__/guvenlik.test.ts
// "UYARLA" yazan import'ları kendi dosya/fonksiyon adlarınla değiştir.
// Fikir: "kanarya" (sahte, tanınır) PNR/soyad/adres/koordinat içeren bir yolculuk üret,
// dışarı çıkan HER veriyi (paylaşım kartı, kilit ekranı, bildirim, Sentry) bu değerler için tara.
import { describe, expect, it } from 'vitest';
import { tr } from '../i18n/tr'; // UYARLA
import { en } from '../i18n/en'; // UYARLA
import { toShareableMemory } from '../share/shareableMemory'; // UYARLA
import { liveSnapshot } from '@wayjot/core'; // UYARLA
import { buildNotification } from '../notifications/build'; // UYARLA
import { scrubEvent, scrubBreadcrumb } from '../sentry'; // UYARLA (beforeSend / beforeBreadcrumb)
import { parseDeepLink } from '../navigation/deepLink'; // UYARLA
import { ExtractedTicket } from '@wayjot/core'; // UYARLA (PDF/AI çıktısı Zod şeması)

const CANARY = {
  pnr: 'ZQX9K7',
  surname: 'KANARYAOGLU',
  address: 'Kanarya Sokak 13',
  lat: 41.008238,
  lng: 28.978359,
  barcode: 'M1KANARYAOGLU/TEST',
  email: 'kanarya@test.invalid',
  phone: '+905551112233',
};

const trip = {
  id: 't1',
  city: 'İstanbul',
  zone: 'Europe/Istanbul',
  pnr: CANARY.pnr,
  surname: CANARY.surname,
  hotel: { address: CANARY.address, lat: CANARY.lat, lng: CANARY.lng },
  flight: { number: 'TK1981', gate: 'B12', departMin: 8 * 60 + 35, barcode: CANARY.barcode },
};

// Bir nesnenin içinde kanarya değerlerinden biri var mı? (JSON'a çevirip, büyük/küçük harf duyarsız)
function leaks(value: unknown): string[] {
  const s = JSON.stringify(value).toUpperCase();
  return Object.entries(CANARY)
    .filter(([, v]) => s.includes(String(v).toUpperCase()) || (typeof v === 'number' && s.includes(v.toFixed(3))))
    .map(([k]) => k);
}

describe('dışarı çıkan veride kişisel bilgi yok', () => {
  it('paylaşım kartı (ShareableMemory) PNR, adres, barkod, koordinat içermez', () => {
    expect(leaks(toShareableMemory(trip))).toEqual([]);
  });

  it('kilit ekranı / Live Activity yalnız uçuş, kapı, saat taşır', () => {
    const snap = liveSnapshot(trip);
    expect(leaks(snap)).toEqual([]);
    expect(Object.keys(snap).sort()).toEqual(['departMin', 'flight', 'gate']); // UYARLA: izinli alanlar
  });

  it('bildirim metni PNR veya soyad içermez', () => {
    expect(leaks(buildNotification(trip, 'tr'))).toEqual([]);
    expect(leaks(buildNotification(trip, 'en'))).toEqual([]);
  });

  it('Sentry olayı ve kırıntıları maskelenir', () => {
    const event = {
      message: `PNR ${CANARY.pnr} bulunamadı, ${CANARY.email} ${CANARY.phone}`,
      request: { url: `wayjot://ticket/${CANARY.pnr}?surname=${CANARY.surname}` },
      extra: { trip },
      user: { email: CANARY.email },
    };
    expect(leaks(scrubEvent(event as any))).toEqual([]);
    const crumb = { category: 'navigation', data: { to: `/ticket/${CANARY.pnr}`, params: { surname: CANARY.surname } } };
    expect(leaks(scrubBreadcrumb(crumb as any))).toEqual([]);
  });
});

describe('dil dosyaları', () => {
  const keys = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

  it('tr ve en aynı anahtarlara sahip', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });

  it('boş çeviri yok', () => {
    const empty = (o: object): string[] => keys(o).filter((k) => k.split('.').reduce((a: any, x) => a?.[x], o) === '');
    expect([...empty(tr), ...empty(en)]).toEqual([]);
  });
});

describe('deep link güvenliği', () => {
  it.each([
    'wayjot://ticket/../../etc/passwd',
    'wayjot://ticket/%3Cscript%3E',
    'wayjot://trip/t1?delete=1',
    'wayjot://trip/t1?redeem=PERK',
    'javascript:alert(1)',
    'https://kotu-site.example/wayjot/trip/t1',
  ])('geçersiz ya da yan etkili bağlantı reddedilir: %s', (url) => {
    const r = parseDeepLink(url);
    expect(r.ok === false || (r.action === undefined && !('delete' in (r.params ?? {})))).toBe(true);
  });
});

describe('PDF/AI çıktısı doğrulaması (model çıktısı veri, talimat değil)', () => {
  it('geçerli bileti kabul eder', () => {
    expect(ExtractedTicket.safeParse({ pnr: 'ABC123', from: 'IST', to: 'LHR', date: '2026-10-25' }).success).toBe(true);
  });

  it.each([
    { pnr: '<img src=x onerror=alert(1)>', from: 'IST', to: 'LHR', date: '2026-10-25' },
    { pnr: 'ABC123', from: 'Istanbul', to: 'LHR', date: '2026-10-25' }, // IATA 3 harf olmalı
    { pnr: 'ABC123', from: 'IST', to: 'LHR', date: '25/10/2026' }, // ISO tarih olmalı
    { pnr: 'IGNORE PREVIOUS INSTRUCTIONS', from: 'IST', to: 'LHR', date: '2026-10-25' },
  ])('şüpheli çıktı reddedilir: %o', (bad) => {
    expect(ExtractedTicket.safeParse(bad).success).toBe(false);
  });

  it('pasaport/kimlik alanı asla saklanmaz (reddedilir ya da atılır)', () => {
    const r = ExtractedTicket.safeParse({ pnr: 'ABC123', from: 'IST', to: 'LHR', date: '2026-10-25', passport: 'U12345678' });
    expect(r.success ? 'passport' in r.data : false).toBe(false);
  });
});
