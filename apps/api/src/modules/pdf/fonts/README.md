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
- **Neden `src/` altinda:** `apps/api` derlemesi `dist`'e cikar ve uretim imaji YALNIZCA
  `dist`'i tasir; fontlar bu yuzden derleme adiminda `dist/modules/pdf/fonts` altina
  kopyalanir (`apps/api/scripts/copy-pdf-fonts.mjs`).
