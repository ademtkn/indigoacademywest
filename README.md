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

### Editörler (kullanıcı adı ve şifreyle giriş)
Asylkech ve Indigo Prime panelleriyle aynı yapı. Editörler panele **kullanıcı adı ve şifre** ile girer; GitHub anahtarı gerekmez, sunucu da gerekmez.
Şifre: yalnızca Latin harf ve rakam, **4–6 karakter** (büyük/küçük harf ayrımı var).

- **Roller:** *Yönetici* içeriği düzenler, editör ekler/siler, rolleri ve şifreleri değiştirir. *Editör* yalnızca içeriği düzenler ve kendi şifresini değiştirir.
- **Kim girdi:** Sol menünün altında giriş yapan kişinin adı görünür; her yayın GitHub geçmişine o kişinin adıyla yazılır.
- **Hatalı denemeler:** 5 hatalı şifreden sonra giriş 30 saniye bekletilir, her yeni hatada süre ikiye katlanır.
- **Anahtarın süresi dolarsa:** Bir yönetici **Editors → Replace GitHub token** bölümüne yeni anahtarı yapıştırır ve yayınlar; editörlerin şifreleri değişmez.

**İlk kurulum (bir kere):**
1. Henüz editör olmadığı için giriş ekranı GitHub anahtarı ister. Aşağıdaki adımlarla anahtar oluşturup girin.
2. **Editors → Turn on editor sign-in** düğmesine basın.
3. İlk editörü (kendinizi) **Administrator** olarak ekleyin, sonra diğerlerini ekleyin ve **Publish**'e basın.
4. 1–2 dakika sonra herkes kullanıcı adı ve şifresiyle girebilir. Sizin anahtarınız giriş ekranındaki
   "Site owner? Sign in with a GitHub token" bağlantısıyla çalışmaya devam eder.

**GitHub anahtarı:** https://github.com/settings/personal-access-tokens/new → Repository access: *Only select repositories* →
`indigoacademywest` → Permissions: **Contents: Read and write**, **Actions: Read-only** (isteğe bağlı).

**Güvenlik notu:** Sunucu olmadığı için GitHub anahtarı, `content/editors.json` (yayında `admin/editors.json`) içinde her editörün
şifresiyle şifrelenmiş olarak herkese açık durur. Şifreden anahtar türetmek için bilerek yavaş ve çok bellek kullanan Argon2id
kullanılır (`admin/auth.js`), yani her tahmin pahalıdır. Yine de bu dosyayı alan biri şifreleri kendi bilgisayarında denemeye çalışabilir:
harf+rakam karışık 6 karakterli bir şifre (ör. `k7Rm2q`) çok uzun sürer, ama `123456` gibi yalnızca rakamlı bir şifre kısa sürede bulunur. Bu yüzden:
- Her editöre farklı ve harf+rakam karışık şifre verin (panelde "Create a password" düğmesi böyle bir şifre üretir).
- GitHub anahtarına yalnızca bu depo için Contents izni verin.

## Yapı
```
content/en|ky|ru.json  Her dilin tüm metinleri (panel düzenler)
content/site.json      Okul bilgileri, menü/sayfa sırası, kadro, fotoğraf yerleri (panel düzenler)
admin/                 Yönetim paneli (statik uygulama, GitHub API ile çalışır); auth.js editör girişi
content/editors.json   Editör hesapları (şifreli; panel yönetir, admin/editors.json olarak yayınlanır)
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
