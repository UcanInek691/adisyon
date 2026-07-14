# PR Özeti

<!-- Ne yaptin, neden? Kisa ve net. -->

## Tür

- [ ] feat (yeni özellik)
- [ ] fix (hata düzeltme)
- [ ] refactor / chore / docs / test

## Kapsam (rol)

- [ ] Maya (satış hattı: masa / sipariş / ödeme / offline)
- [ ] Çağrı (platform: worker / scheduler / health / feature-flag / yazdırma / rapor / kasa / veresiye / stok / backup)
- [ ] Çekirdek (ortak — karşı tarafın onayı gerekir)

## Kontrol listesi

- [ ] Yalnızca kendi sahiplik alanımı değiştirdim (CODEOWNERS). Çekirdeğe dokunduysam karşı tarafı inceleyici ekledim.
- [ ] Commit mesajları Conventional Commits (`feat:`, `fix:` ...).
- [ ] İlgili dokümanı güncelledim (kod ve doküman ayrılmaz — yeni event ⇒ `DOMAIN_EVENTS.md`, yeni model ⇒ ilgili `prisma/schema/*.prisma`).
- [ ] Şema değiştiyse: yalnızca kendi domain dosyamda + migration ürettim.
- [ ] Modüller arası iletişim doğrudan çağrı değil **Event Bus** üzerinden (`EVENT_BUS.md`).
- [ ] Yerelde geçti: `pnpm lint && pnpm typecheck && pnpm format:check`.
- [ ] CI yeşil.

## Notlar / ekran görüntüsü

<!-- Varsa. -->
