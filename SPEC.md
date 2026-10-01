# Sonora – specifikáció és döntésnapló

> Állapot: **2a fázis (szerkesztő alapok) kész.** Kottát írni, menteni és megnyitni lehet.

## Cél
Saját használatú kottaprogram (később akár Play Áruház). Fekete kotta → egy gombnyomással színes vagy üres (kifestős) kotta, transzponálás, nyomtatás. Meglévő (Finale) kották színessé tétele.

- Felhasználó: egyelőre csak a tulajdonos (zongorista, 6–7 év).
- Szakmai ellenőr: a tulajdonos zongoratanára.
- Keret: 0 Ft, egyetlen fejlesztő + Claude Pro (korlátozott heti keret → kis, lezárt lépések).

## Platform
- Offline webes app (TypeScript, HTML/CSS), internet nélkül fut, asztali gépen, **egér + billentyűzet**.
- Később ugyanaz a kód Android-appá csomagolható (pl. Capacitor / TWA).
  - Play Áruház: 25 USD egyszeri díj, új magánfióknál zárt teszt (12 tesztelő, 14 nap).
  - Androidon az érintéses kezelést át kell majd tervezni.
- Kottarajzolás: **Verovio** (nyílt forrású, WebAssembly, internet nélkül fut). Nyelv: TypeScript + Vite, keretrendszer nélkül.
- A kész program **egyetlen `index.html`** (`npm run build` → `dist/index.html`), dupla kattintással megnyitható.
- **Hosting: Vercel** – a `main` ág minden pushra automatikusan élesedik (`vercel.json`). A projektet a tulajdonos hozza létre a Vercel oldalán (a Vercel-csatlakozó 403-mal elutasítja). A GitHub Pages közzététel elbukott, ezért kivettük. **PWA**: telepíthető; online mindig a legfrissebb verziót tölti le, offline a legutóbb letöltöttel indul (`public/sw.js`).
- Fájlformátum: **MusicXML** (import + export). Ez a Finale-kapcsolat is.

## Színrendszer (a termék lényege)
Színezés mindig a **megszólaló hang** szerint (transzponáló hangszernél is; transzponáláskor a színek is változnak).

| Hang | Szín |
|---|---|
| C | fekete |
| D | barna |
| E | kék |
| F | zöld |
| G | piros |
| A | narancs |
| H | citromsárga |

- **Köztes hangok** (Cisz/Desz, Disz/Esz, Fisz/Gesz, Gisz/Asz, B/Aisz): kettéosztott kottafej, **átlós választóvonal bal lentről jobb fentre**. **A vonal fölötti (bal felső) fél a felső hang, a vonal alatti (jobb alsó) fél az alsó hang színe** (pl. Cisz: fent barna, lent fekete). *(Javítva: korábban tévesen „bal lent / jobb fent” szerepelt, de azok a sarkok magán a vonalon vannak.)* Enharmonikus párok (Cisz = Desz) ugyanúgy néznek ki.
- Csak a **kottafej** színes.
- Javaslat (még nem jóváhagyott): vékony sötét körvonal minden színes fejen (a citromsárga fehér papíron alig látszik).

## Nézetek
1. **Fekete** – normál kotta.
2. **Színes** – a fenti színrendszer.
3. **Üres (kifestős)** – házi feladathoz, a tanuló színezi ki.
   - ⚠ Nyitott: a negyed/nyolcad üres feje nem tűnhet félhangnak → a tanárral egyeztetni.

## Sorok / szólamok
- Tetszőleges számú sor (zongora, orgona, több hangszer, nagy partitúra).
- Gomb: **új sor beszúrása bárhová**. Az adatmodell az elejétől N sort kezel.

## Funkciók (a kézzel írt jegyzetből)
- Kottaírás feketén/színesen; váltás fekete ↔ színes ↔ üres
- Hangnemváltás; transzponálás félhang/egész hang/terc/kvart stb. fel-le
- Violin-, basszus-, alt-, tenorkulcs; ütemmutató; bpm; előjegyzés (#, b, feloldójel)
- Hangértékek (egész, fél, negyed, nyolcad, tizenhatod) és pontozott változataik; minden szünet
- Átkötések, különböző kottafejek, pótvonalak, ütemvonal, hangnemváltó vonal, záróvonal
- Agogikai/dinamikai jelek: < > korona, ékezet, levegővétel, coda stb.
- Több oldal, oldalváltás gomb; undo/redo; nyomtatás; helyi mentés/letöltés
- Kottabeolvasás PDF/PNG-ből (OMR) – **későbbi, bizonytalan fázis**

## Fázisok
1. ✅ **Színező:** MusicXML betöltés → fekete/színes/üres nézet → transzponálás → nyomtatás/PDF
2. **Szerkesztő:**
   - ✅ **2a** – új kotta, hang/szünet beírása és törlése, hangértékek, pont, #/b/feloldójel, oktáv, kulcs, hangnem, ütemmutató, tempó, sorok, undo/redo, MusicXML mentés és megnyitás
   - **2b** – ütemvonalak, ismétlőjel, záróvonal, kulcs- és hangnemváltás a darab közben, oldalváltás
   - **2c** – kötőív, átkötés, dinamika, korona, ékezet, staccato, coda/segno
   - **2d** – akkordok, több szólam egy soron
3. **Android** csomagolás
4. *(talán)* OMR – PDF/PNG beolvasás

## Elkészült (1. fázis)
- [x] MusicXML megnyitás (`.musicxml`, `.xml`, `.mxl`), minta kotta
- [x] Fekete / színes / kifestős nézet, körvonal kapcsoló
- [x] Színezés a megszólaló hang szerint (transzponáló hangszernél is)
- [x] Transzponálás félhang … oktáv lépésekkel, ±1 oktávig
- [x] Nyomtatás / PDF (A4, színhelyesen)
- [x] Online hosting + telepíthető offline app (PWA), automatikus frissítéssel

## Elkészült (2a fázis)
- [x] Adatmodell (`src/model.ts`) és MusicXML írás/olvasás (`src/musicxml.ts`) – a kotta ebből készül
- [x] Hang és szünet beírása billentyűzetről (C D E F G A H, B = bé) és gombokkal
- [x] Hangértékek (egész…tizenhatod), 1–2 pont, #/b/feloldójel, oktáv 1–7
- [x] Kurzor, mozgás, törlés, korlátlan undo/redo
- [x] Cím, hangnem, ütemmutató, tempó, kulcs (violin/basszus/alt/tenor), sor neve
- [x] Sor beszúrása a végére vagy a kurzor helyére, sor törlése
- [x] Mentés MusicXML-be és megnyitás

## Ismert korlátok (2a)
- A transzponálás **csak a képernyőn és nyomtatásban** hat; a mentett fájl az eredeti hangnemben marad.
- Ütemvonalon átnyúló hang nincs: ha egy hang nem fér be, új ütemet kezd, az előző ütem rövidebb marad (átkötés = 2c).
- A `.mxl` (tömörített) fájlt a szerkesztő nem nyitja meg, csak a sima `.musicxml`-t.
- Beolvasáskor az akkordok további hangjai és az 1-től eltérő szólamok kimaradnak.
- Egy sorban egy szólam, akkord nélkül (2d).

## Nyitott kérdések
- [ ] Fotó: színes kotta és kifestős házi minta a tanártól
- [ ] Finale-fájlok kiterjesztése (`.musx` / `.mus` / `.pdf`)? Megvan-e még a Finale (MusicXML export)?
- [ ] Tanár véleménye: kifestős mód – negyed vs. fél hang megkülönböztetése. **A jelenlegi megvalósításban a negyed üres feje tényleg félhangnak tűnik – dönteni kell.**
- [ ] Az átlós felezés színkiosztása (fent felső hang, lent alsó hang) jó-e így?
- [ ] Színes fejek körvonala – kell-e?
