# Indigo Academy West — web sitesi

Indigo Academy ağına bağlı **Indigo Academy West** (İlkokul 1–6 + Ortaokul/Lise 7–12, kız-erkek karışık) için
3 dilli (İngilizce, Kırgızca, Rusça) statik site. Asylkech Girls' School sitesiyle aynı altyapıyı kullanır;
tasarım, logodaki koyu yeşil + altın renklerine göre yeniden yapıldı.

## Yönetim paneli (admin)
Site, Joomla/WordPress'teki gibi bir **yönetim paneli** ile düzenlenir:
**https://ademtkn.github.io/indigoacademywest/admin/**

Panelin kendi dili İngilizce, Kırgızca veya Rusça seçilebilir. Her metin üç dilde yan yana düzenlenir (telefonda sekmelerle).

| Bölüm | Neler yapılır |
|---|---|
| Sayfalar ve menü | Menü sırasını değiştirme, menü adlarını 3 dilde düzenleme, sayfayı menüden gizleme, **yeni sayfa ekleme / silme** |
| Metinler | Her sayfadaki tüm metinler 3 dilde; listelere (avantajlar, SSS, takvim, kulüpler…) öğe ekleme, silme, sıralama |
| Fotoğraflar | Sayfalardaki tüm fotoğrafları yükleme / değiştirme / silme (tarayıcıda otomatik küçültülür) |
| Kadro | Öğretmen ekleme / silme / sıralama, fotoğraf, isim ve görev (3 dilde), bölüm |
| Okul bilgileri | Telefonlar, WhatsApp, Instagram, 2GIS, adres ve çalışma saatleri |

**Yayınla** düğmesi değişiklikleri GitHub'a tek bir kayıt (commit) olarak gönderir. Ardından
`.github/workflows/build.yml` siteyi otomatik derler; site yaklaşık 1–2 dakikada güncellenir.
Panelde "Done! The site is updated" görünür (anahtarda Actions: Read izni varsa).

### Editörler ve şifreli giriş
Editörler panele **kullanıcı adı ve şifre** ile girer. Şifre **4–6 karakter, sadece Latin harf ve rakam** olabilir
(ör. `ak47m2`). Yöneticiler panelin **Editörler** bölümünden editör ekler, siler, engeller, rolünü değiştirir ve yeni şifre verir.
Herkes kendi şifresini **Hesabım** bölümünden değiştirebilir.

Kısa şifreler genelde kolay tahmin edilir. Bu yüzden şifreler herkese açık depoda değil, ayrı bir giriş sunucusunda
(`admin-server/`, ücretsiz Cloudflare Worker) tutulur ve korunur:
- Şifreler sadece şifrelenmiş (PBKDF2 özeti) olarak saklanır.
- Aynı hesaba 5 yanlış denemede hesap 15 dakika kilitlenir; aynı adresten 20 yanlış denemede o adres kilitlenir.
- Editörler GitHub anahtarını hiç görmez. Sunucu onların sadece `content/*.json` dosyalarını ve `assets/img/photos|staff`
  altındaki fotoğrafları değiştirmesine izin verir. Kodu, tasarımı veya otomatik derlemeyi değiştiremezler, siteyi eski bir sürüme döndüremezler.
- Her yayın, yapan editörün adıyla kaydedilir (GitHub geçmişinde görünür).

#### Giriş sunucusunu kurmak (bir kere, ~10 dakika)
Gerekenler: ücretsiz bir Cloudflare hesabı ve bilgisayarda Node.js.
1. GitHub'da sunucu için bir anahtar oluşturun: https://github.com/settings/personal-access-tokens/new
   → Repository access: `indigoacademywest` → Contents: **Read and write**, Actions: **Read-only**.
2. Terminalde:
   ```
   cd admin-server
   npx wrangler login
   npx wrangler kv namespace create USERS      # çıkan "id" değerini wrangler.toml içindeki id alanına yazın
   npx wrangler secret put GITHUB_TOKEN         # 1. adımdaki anahtarı yapıştırın
   npx wrangler secret put SETUP_CODE           # uzun, sadece sizin bildiğiniz bir ifade (ilk yönetici için)
   npx wrangler deploy                          # sonunda https://indigo-west-admin.<hesap>.workers.dev adresi çıkar
   ```
3. Depodaki `admin/config.json` dosyasına bu adresi yazın (GitHub'da dosyayı açıp kalem simgesiyle düzenleyebilirsiniz):
   ```json
   { "api": "https://indigo-west-admin.<hesap>.workers.dev" }
   ```
4. Site güncellendikten sonra paneli açın. Henüz kullanıcı olmadığı için **ilk yönetici** ekranı gelir:
   SETUP_CODE'u, adınızı, kullanıcı adınızı ve şifrenizi girin. Sonra **Editörler** bölümünden editörleri ekleyin.

Sitenin kendi alan adı bağlanınca bu adresi `admin-server/wrangler.toml` içindeki `ALLOWED_ORIGINS` listesine ekleyip
`npx wrangler deploy` ile sunucuyu güncelleyin.

#### Site sahibi için yedek giriş (GitHub anahtarı)
Giriş sunucusu kurulmadan önce, ya da sunucuya ulaşılamadığında, site sahibi giriş ekranındaki
"Site owner: sign in with a GitHub key" bağlantısıyla kendi GitHub anahtarıyla girebilir:
https://github.com/settings/personal-access-tokens/new → Repository access: `indigoacademywest` → Contents: **Read and write**.
Bu anahtar kimseyle paylaşılmamalıdır; editörler her zaman kullanıcı adı ve şifreyle girmelidir.

## Yapı
```
content/en|ky|ru.json  Her dilin tüm metinleri (panel düzenler)
content/site.json      Okul bilgileri, menü/sayfa sırası, kadro, fotoğraf yerleri (panel düzenler)
admin/                 Yönetim paneli (statik uygulama); admin/config.json giriş sunucusunun adresi
admin-server/          Editörlerin şifreli girişi için Cloudflare Worker (kullanıcılar, kilitleme, GitHub'a güvenli erişim)
src/build.mjs          Sayfa şablonları; content/ dosyalarından siteyi docs/ klasörüne üretir
assets/css, js, img    Tasarım, betikler, logo ve fotoğraflar
.github/workflows/     Her değişiklikte siteyi otomatik derleyen GitHub Action
docs/                  Derlenmiş site (GitHub Pages bu klasörü yayınlar)
```

Elle derleme: `node src/build.mjs` (Node 18+, bağımlılık yok).

Sayfalar (her dilde ayrı): `index` (Ana sayfa), `about`, `primary` (İlkokul 1–6), `secondary` (Ortaokul & Lise 7–12),
`admissions`, `school-life`, `staff` (Kadro), `news`, `contact` ve panelden eklenen sayfalar. Adresleri: `/en/…`, `/ky/…`, `/ru/…`.
Kök `index.html` dil seçim sayfasıdır.

## Öğretmen fotoğrafları ve diğer fotoğraflar
Panelde **Kadro** bölümünden her öğretmenin fotoğrafını yükleyip adını ve görevini üç dilde yazın.
Sayfa fotoğrafları **Fotoğraflar** bölümünden yüklenir. Fotoğraf yüklenene kadar sitede tasarımlı bir yer tutucu görünür.

## Yayından önce doğrulanacaklar
- **Telefon / WhatsApp:** +996 557 12 33 33 bir rehber sitesinden alındı. Panelde **Okul bilgileri** bölümünden kontrol edin.
- **Adres:** Московская 191а (2GIS kaydına göre). Çalışma saati 08:00–18:00 olarak yazıldı.
- **Cambridge aşamaları:** Lise sayfasındaki 7–8 / 9–10 / 11–12 adımları genel ifadelerle yazıldı; panelde Metinler → 7–12 → Cambridge yolu bölümünden düzeltin.
- Günlük program saatleri, kabul belgeleri, SSS cevapları ve takvim taslaktır.
- Alan adı bağlanınca panelde Okul bilgileri → Gelişmiş bölümünden site adresini güncelleyin.

## Yapay zeka asistanı (sağ alt köşe)
Asylkech sitesindekiyle aynı: sadece okulla ilgili soruları, sitenin metinlerinden üretilen bilgi tabanıyla
(`docs/assets/data/kb-*.json`) cevaplar. Gerçek yapay zeka için `server/` klasöründeki Cloudflare Worker'ı kurun:
```
cd server && npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
Sonra panelde Okul bilgileri → Gelişmiş → "School assistant server" alanına Worker adresini yazın, `wrangler.toml` içindeki `ALLOWED_ORIGINS`'e site adresini ekleyip tekrar derleyin.
Sunucu yoksa asistan site metinlerinde anahtar kelime araması yapar.

## Yayın: GitHub Pages
1. **Settings → Pages → Source: Deploy from a branch**, **Branch: `main`**, klasör **`/docs`** → **Save**.
2. **Settings → Actions → General → Workflow permissions:** "Read and write permissions" seçili olmalı
   (otomatik derlemenin `docs/` klasörünü kaydedebilmesi için).
3. Adres: `https://ademtkn.github.io/indigoacademywest/` — panel: `…/indigoacademywest/admin/`

Alan adı bağlanınca panelde Okul bilgileri → Gelişmiş bölümünden site adresi ve alan adını girin (derleme `docs/CNAME` yazar).
