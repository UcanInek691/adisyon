# Adisyon POS — Kurulum ve Kullanım Kılavuzu

> Bu belge işletme sahibine ve personele yöneliktir. Teknik bilgi gerektirmez.
> Amaç: sistemi kurmak, ilk ayarları yapmak ve günlük kullanmak.

---

## 1. Sistem Nasıl Çalışır? (Kısaca)

Adisyon POS, kafe/restoran/büfe/pastane için **çevrimdışı çalışabilen** bir adisyon/satış otomasyonudur.

- **Ana makine (kasa bilgisayarı):** Programın kurulu olduğu Windows bilgisayar. Tüm veriler
  (adisyonlar, ürünler, ödemeler, raporlar) **burada** tutulur. İnternete ihtiyaç duymaz.
- **Garson tabletleri / telefonlar:** Aynı WiFi ağına bağlı cihazlar, tarayıcıdan ana makineye
  bağlanır ve sipariş alır. Ayrı program kurmaya gerek yoktur.
- **İnternet gerekmez:** Sistem tamamen yerel ağda (kendi WiFi'niz) çalışır. İnternet yalnızca
  isteğe bağlı **bulut yedeği** için kullanılır.

```
        WiFi / Yerel Ağ (internet gerekmez)
   ┌───────────────┬───────────────┬───────────────┐
 [Tablet 1]     [Tablet 2]      [Tablet 3]   ...
   garson         garson          garson
        │              │               │
        └──────────────┴───────────────┘
                       │
              [ ANA MAKİNE / KASA ]
              Program + tüm veriler burada
```

**En önemli özellik:** Bir garson tabletinin WiFi bağlantısı kopsa bile garson **sipariş almaya
devam eder**. Bağlantı gelince siparişler otomatik ve kayıpsız senkronlanır.

---

## 2. Gereksinimler

| | Öneri |
|---|---|
| **Ana makine** | Windows 10/11, 4 GB RAM, açık kalabilen bir bilgisayar (kasa PC) |
| **Ağ** | Bir WiFi router (internet şart değil); ana makine tercihen **kabloyla** bağlı |
| **Tabletler** | Güncel bir tarayıcısı olan herhangi bir tablet/telefon (Android/iPad/Windows) |
| **Yazıcı** | (İsteğe bağlı) Mutfak/fiş yazıcısı |

> **İpucu:** Ana makineye **sabit yerel IP** verilmesi tavsiye edilir; böylece tabletlerin adresi
> hep aynı kalır.

---

## 3. Kurulum (Ana Makine)

1. Size verilen **kurulum dosyasını** (`Adisyon-POS-Setup.exe`) ana makinede çalıştırın.
2. Kurulum sihirbazını takip edip **Kur** deyin.
3. Kurulum bitince masaüstündeki **Adisyon POS** simgesiyle programı açın.

Program ilk açıldığında kendi kendine hazırlanır (birkaç saniye sürebilir). Tüm veriler bu
bilgisayarda güvenle saklanır; taşımak/yedeklemek için 10. bölüme bakın.

---

## 4. İlk Açılış — Yönetici Hesabı Oluşturma

Program **ilk kez** açıldığında sizi bir **kurulum ekranı** karşılar (henüz kullanıcı yoktur):

1. **Yönetici (Owner) kullanıcı adı** ve **şifre** belirleyin.
2. **Kaydet** deyin.

Bu hesap **işletme sahibi** hesabıdır: her yetkiye sahiptir (ürün, kasa, rapor, kullanıcı yönetimi).
Şifreyi güvenli tutun.

> Bundan sonra her açılışta bu kullanıcı adı/şifre ile giriş yaparsınız.

---

## 5. Başlangıç Ayarları (Bir Kez Yapılır)

Yönetici olarak giriş yaptıktan sonra üst menüden şu ayarları yapın:

### 5.1 Garson (Personel) Hesapları — **Kullanıcılar**
- Her garson için bir hesap açın; garsonlar **4 haneli PIN** ile hızlıca giriş yapar.
- Garsonlar yalnızca **sipariş alma** yetkisine sahiptir (ödeme/kasa/rapor göremez).

### 5.2 Salonlar ve Masalar — **Masa Yönetimi**
- Önce **salon** ekleyin (örn. "İç Salon", "Bahçe").
- Sonra her salona **masalarını** ekleyin.

### 5.3 Ürünler — **Ürünler**
- **Kategori** ekleyin (örn. "İçecekler", "Ana Yemek").
- Gerekirse **birim** (adet, porsiyon) ve **KDV oranı** tanımlayın.
- **Ürünleri** fiyatlarıyla ekleyin. (İsterseniz ürün için **stok takibi**ni açabilirsiniz.)

Bu ayarlar bittiğinde sistem satışa hazırdır.

---

## 6. Tabletlerin Bağlanması

1. Tabletleri **ana makineyle aynı WiFi ağına** bağlayın.
2. Ana makinenin **yerel IP adresini** öğrenin (kurulumu yapan kişi verir; örn. `192.168.1.20`).
3. Tabletin tarayıcısında şu adresi açın:

   ```
   http://<ana-makine-ip>:3001
   ```
   Örnek: `http://192.168.1.20:3001`

4. Açılan ekranda garson **PIN** ile giriş yapar.
5. **Öneri — uygulama gibi kullanın:** Tarayıcı menüsünden **"Ana ekrana ekle"** deyin. Böylece
   simge oluşur ve uygulama tam ekran, hızlı açılır. (Bir kez açıldıktan sonra **çevrimdışı da açılır.**)

> Aynı anda birden fazla tablet bağlanabilir; hepsi aynı masaları canlı görür.

---

## 7. Günlük Kullanım Akışı

1. **Masalar ekranı:** Boş masa gri, dolu masa sarı, bekletilen mor görünür.
2. **Sipariş alma:** Boş masaya dokun → adisyon açılır. Kategoriden ürünlere dokunarak ekle;
   adet **+ / −** ile ayarlanır, gönderilmemiş kalem silinebilir.
3. **Mutfağa Gönder:** Kalemler hazırsa "Mutfağa Gönder" ile mutfağa/kasaya iletilir (ve varsa
   mutfak fişi basılır). Gönderilen kalem kilitlenir; değişiklik için yöneticiden **iptal (void)**
   gerekir.
4. **Ödeme / Kapatma:** Ödeme **kasadan/yöneticiden** alınır (nakit/kart/veresiye, kısmi/split
   ödeme, para üstü). Ödeme tamamlanınca masa boşalır.
5. **Ek işlemler (yönetici):** Masa taşı/birleştir, adisyon böl, indirim (yüksek indirim yönetici
   onayı ister), beklet/çağır.
6. **Gün Sonu:** Gün bitince **Kasa → Gün Sonu (Z raporu)** ile kasa sayımı ve özet alınır.

---

## 8. Çevrimdışı (Offline) Çalışma — Önemli

Bu sistemin en güçlü yanı: **bağlantı koptuğunda satış durmaz.**

**Garson tabletinde bağlantı durumu her zaman görünür:**
- 🟢 **Çevrimiçi** — her şey anlık senkron.
- 🔴 **Çevrimdışı** — bağlantı yok; siparişler tablette güvenle birikiyor.
- 🟡 **Senkronlanıyor** — bağlantı geldi, bekleyenler gönderiliyor.

**Bağlantı kopukken garson yapabilir:**
- Masa açmak, ürün eklemek/çıkarmak, adet değiştirmek, **mutfağa göndermek.**

Bu işlemler tablette **kalıcı** saklanır — tablet kapansa, yenilense veya şarjı bitse bile
kaybolmaz. Bağlantı gelince **otomatik ve kayıpsız** senkronlanır. Bekleyen sipariş kaleminde
"⏳ senkron bekliyor" işareti görünür; gönderilince kalkar.

**Bağlantı kopukken yapılamaz (güvenlik gereği):** ödeme, kasa işlemleri, yüksek indirim, iade,
kayıt silme. Bunlar her zaman **yönetici + ana makine** üzerinden yapılır.

### Çakışma olursa — Yönetici Onayı
Nadiren, bir garson çevrimdışıyken bir masa bu sırada kapatılmış olabilir. Böyle bir durumda
sipariş kaybolmaz; **yöneticinin "Offline Onay" ekranına** düşer. Yönetici tek dokunuşla seçer:
- **Yeni adisyon** aç ve kalemleri taşı,
- **Kapalı adisyonu yeniden aç** ve ekle, ya da
- **Reddet.**

Böylece hiçbir sipariş sessizce kaybolmaz.

---

## 9. Yetkiler (Kim Ne Yapar?)

| Rol | Yapabilir |
|-----|-----------|
| **Yönetici (Owner)** | Her şey: ürün/masa/kullanıcı yönetimi, ödeme, kasa, indirim, iade, raporlar, yedek |
| **Garson** | Sipariş alma (masa aç, kalem ekle, mutfağa gönder). Ödeme/kasa/rapor **göremez** |

---

## 10. Yedekleme

- **Otomatik günlük yedek:** Her gün sabah **06:00**'da sistem kendi kendine yedek alır.
- **Bulut kopyası (isteğe bağlı):** Ayarlardan bir senkron klasörü (OneDrive, Google Drive vb.)
  seçerseniz yedekler oraya da kopyalanır — bilgisayar arızalansa bile veriniz güvende olur.
- **Elle yedek / geri yükleme:** **Ayarlar** ekranından istediğiniz an yedek alabilir veya bir
  yedeği geri yükleyebilirsiniz (geri yükleme sonrası program yeniden başlatılır).

> **Tavsiye:** Bulut kopyasını mutlaka açın ve ayda bir yedeği harici bir diske alın.

---

## 11. Sık Karşılaşılanlar / Sorun Giderme

**Tablet ana makineye bağlanamıyor.**
- Tablet ve ana makine **aynı WiFi'de** mi? Adres doğru mu (`http://<ip>:3001`)?
- Ana makinede program açık mı? Windows güvenlik duvarı ilk seferde izin sormuş olabilir — **izin verin.**

**Tabletlerin adresi değişiyor.**
- Ana makineye router'dan **sabit IP** verin; adres bir daha değişmez.

**Bağlantı koptu, garson ne yapmalı?**
- Hiçbir şey — sipariş almaya devam etsin. Rozet 🔴 olur, bağlantı gelince kendiliğinden 🟡→🟢 olur
  ve bekleyenler gönderilir.

**Bir sipariş "Offline Onay"a düştü.**
- Yönetici **Masalar** ekranındaki **"Offline Onay"** butonundan ilgili kaydı görüp karar verir
  (bkz. 8. bölüm).

**Ana makineyi değiştireceğim / formatlayacağım.**
- Önce **yedek alın** (10. bölüm), yeni makineye kurulum yapıp yedeği **geri yükleyin.**

---

## 12. Özet — Hızlı Başlangıç

1. Ana makineye programı kur → aç → **yönetici hesabı** oluştur.
2. **Kullanıcılar, Masalar, Ürünler**'i tanımla.
3. Tabletleri aynı WiFi'ye bağla, `http://<ana-makine-ip>:3001` adresini aç, **ana ekrana ekle.**
4. Garsonlar **PIN** ile girsin, sipariş almaya başlasın.
5. Ödeme/gün sonu **kasadan**; **bulut yedeğini** aç.

Kolay gelsin.
