# Indigo Academy West — web sitesi

Indigo Academy ağına bağlı **Indigo Academy West** (İlkokul 1–6 + Ortaokul/Lise 7–12, kız-erkek karışık) için
3 dilli (İngilizce, Kırgızca, Rusça) statik site. Asylkech Girls' School sitesiyle aynı altyapıyı kullanır;
tasarım, logodaki koyu yeşil + altın renklerine göre yeniden yapıldı.

## Yapı
```
src/build.mjs          Sayfa şablonları + okul bilgileri (telefon, Instagram, adres, kadro listesi)
src/content/en|ky|ru   Her dilin tüm metinleri
assets/css, js, img    Tasarım, betikler, logo (logo-round.png) ve amblem maskesi (emblem-*.png)
docs/                  Derlenmiş site (GitHub Pages bu klasörü yayınlar)
```

Derleme: `node src/build.mjs` (Node 18+, bağımlılık yok).

Sayfalar (her dilde ayrı): `index` (Ana sayfa), `about`, `primary` (İlkokul 1–6), `secondary` (Ortaokul & Lise 7–12),
`admissions`, `school-life`, `staff` (Kadro), `news`, `contact`. Adresleri: `/en/…`, `/ky/…`, `/ru/…`.
Kök `index.html` dil seçim sayfasıdır.

## Öğretmen fotoğrafları (Instagram'dan)
Instagram'a bu çalışma ortamından erişilemediği için kadro kartları şu an yer tutucudur. Her öğretmen için:
1. Fotoğrafı https://www.instagram.com/indigo_academy_west/ adresinden indirin.
2. `assets/img/staff/<id>.jpg` olarak kaydedin (dikey, ~800×1000 px önerilir).
3. `src/build.mjs` içindeki `STAFF` listesinde ilgili kişinin `name` alanını doldurun:
   `name: 'Айгүл Асанова'` veya dile göre `name: { en: '…', ky: '…', ru: '…' }`.
4. `node src/build.mjs` çalıştırın.

| id | Görev |
|---|---|
| `director`, `deputyPrimary`, `deputySecondary`, `cambridge` | Yönetim |
| `primary1` … `primary6` | 1–6. sınıf öğretmenleri |
| `native1`, `native2`, `english1`, `english2` | İngilizce (ana dili İngilizce olanlar + diğer) |
| `math`, `science`, `chembio`, `cs`, `humanities`, `russian`, `kyrgyz` | Ortaokul/lise branş |
| `robotics`, `chess`, `komuz`, `art`, `pe` | Robotik, satranç, komuz, sanat, beden |
| `psychologist`, `nurse`, `admissions` | Destek ekibi |

Kadroda farklı kişi/görev varsa `STAFF` listesine satır ekleyip görev adını üç dildeki `staff.roles` altına yazın.

## Diğer fotoğraflar
Dosyayı aşağıdaki adla koyup tekrar derleyin; tasarımdaki yer tutucu otomatik olarak fotoğrafla değişir.

| Dosya | Nerede |
|---|---|
| `assets/img/photos/home-welcome.jpg` | Ana sayfa karşılama |
| `assets/img/photos/stage-1.jpg`, `stage-2.jpg` | İlkokul / Lise kartları (Ana sayfa) |
| `assets/img/photos/life-1.jpg` … `life-4.jpg` | Ana sayfa ve Okul hayatı kolajı |
| `assets/img/photos/about-story.jpg`, `director.jpg` | Hakkımızda |
| `assets/img/photos/singapore.jpg`, `primary-english.jpg` | İlkokul sayfası |
| `assets/img/photos/secondary-care.jpg`, `secondary-english.jpg` | Lise sayfası |
| `assets/img/photos/news-instagram.jpg`, `news-whatsapp.jpg` | Haberler |

## Yayından önce doğrulanacaklar
- **Telefon / WhatsApp:** +996 557 12 33 33 bir rehber sitesinden alındı (2GIS'e buradan erişilemedi). `SITE.phones` ve `SITE.whatsapp` alanlarını kontrol edin.
- **Adres:** Московская 191а (2GIS kaydına göre). Çalışma saati 08:00–18:00 olarak yazıldı.
- **Cambridge aşamaları:** Lise sayfasındaki 7–8 / 9–10 / 11–12 adımları ve IELTS hazırlığı genel ifadelerle yazıldı; okulun gerçek programına göre `secondary.pathway` metinlerini düzeltin.
- Günlük program saatleri, kabul belgeleri, SSS cevapları ve takvim taslaktır.
- `SITE.url` alanına gerçek adresi yazın (hreflang ve sitemap için).

## Yapay zeka asistanı (sağ alt köşe)
Asylkech sitesindekiyle aynı: sadece okulla ilgili soruları, sitenin metinlerinden üretilen bilgi tabanıyla
(`docs/assets/data/kb-*.json`) cevaplar. Gerçek yapay zeka için `server/` klasöründeki Cloudflare Worker'ı kurun:
```
cd server && npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
Sonra `SITE.aiEndpoint` alanına Worker adresini yazın, `wrangler.toml` içindeki `ALLOWED_ORIGINS`'e site adresini ekleyip tekrar derleyin.
Sunucu yoksa asistan site metinlerinde anahtar kelime araması yapar.

## Yayın: GitHub Pages
1. GitHub'da `indigoacademywest` adında bir depo açıp bu klasörü gönderin.
2. **Settings → Pages → Source: Deploy from a branch**, **Branch: `main`**, klasör **`/docs`** → **Save**.
3. Adres: `https://ademtkn.github.io/indigoacademywest/`

Alan adı bağlanınca `SITE.url` ve `SITE.customDomain` alanlarını güncelleyip derleyin (derleme `docs/CNAME` yazar).
