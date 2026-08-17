# PDF gomulu fontlari (H-001)

PDF ciktisi PDFKit'in 14 standart fontuyla uretiliyordu; bunlar **WinAnsi** kodlamasindadir
ve Turkce'ye ozgu `ş ğ ı Ş İ` harflerini TASIMAZ (`ç ö ü` Latin-1'de oldugu icin dogru
basiliyor, bu kismi calisma hatayi gizliyordu). Bu dizindeki fontlar `registerFont` ile
belgeye GOMULUR (bkz. `../report-pdf.builder.ts`).

| Dosya                 | Kullanim                                    |
| --------------------- | ------------------------------------------- |
| `DejaVuSans.ttf`      | Govde metni (`BODY_FONT`)                   |
| `DejaVuSans-Bold.ttf` | Baslik ve onay blogu basligi (`TITLE_FONT`) |

- **Aile:** DejaVu Fonts 2.37 (<https://dejavu-fonts.github.io/>), `dejavu-fonts-ttf` 2.37.3
  paketindeki degistirilmemis kopyalar.
- **Lisans:** `LICENSE.txt` (Bitstream Vera Fonts Copyright + Arev Fonts Copyright; serbest
  kullanim/dagitim/gomme izni verir, kaynak metin degistirilmeden birlikte tasinir).
- **Neden depoda:** calisma zamaninda hicbir agdan indirme yapilmaz; e2e testler ve uretim
  imaji fontu depodan alir (ticket H-001 teknik notu, CLAUDE.md §6.2).
- **Neden `src/` altinda:** `apps/api` derlemesi `dist`'e cikar ve uygulama (hem uretim
  imaji hem yerel watch) `dist`'ten kosar; fontlar bu yuzden **iki derleme yolunun da**
  ciktisina kopyalanir:
  - `npm run build` (uretim; `tsc` varlik kopyalamaz) → `apps/api/scripts/copy-pdf-fonts.mjs`
  - `npm run start:dev` / `nest build` (yerel watch; `docker compose up`) →
    `apps/api/nest-cli.json` icindeki `compilerOptions.assets` kurali
- **Eksik kopyanin bedeli:** font baytlari modul yuklenirken okunur; kopya eksikse hata PDF
  istegi geldiginde degil, uygulama **acilirken** ENOENT ile patlar.
