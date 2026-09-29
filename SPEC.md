# Sonora – specifikáció és döntésnapló

> Állapot: **1. fázis (színező) – első működő verzió kész.** A kódolást a tulajdonos engedélyezte.

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
1. **Színező:** MusicXML betöltés → fekete/színes/üres nézet → transzponálás → nyomtatás/PDF
2. **Szerkesztő:** kottaírás, sorok hozzáadása, undo/redo, teljes jelkészlet
3. **Android** csomagolás
4. *(talán)* OMR – PDF/PNG beolvasás

## Elkészült (1. fázis)
- [x] MusicXML megnyitás (`.musicxml`, `.xml`, `.mxl`), minta kotta
- [x] Fekete / színes / kifestős nézet, körvonal kapcsoló
- [x] Színezés a megszólaló hang szerint (transzponáló hangszernél is)
- [x] Transzponálás félhang … oktáv lépésekkel, ±1 oktávig
- [x] Nyomtatás / PDF (A4, színhelyesen)

## Nyitott kérdések
- [ ] Fotó: színes kotta és kifestős házi minta a tanártól
- [ ] Finale-fájlok kiterjesztése (`.musx` / `.mus` / `.pdf`)? Megvan-e még a Finale (MusicXML export)?
- [ ] Tanár véleménye: kifestős mód – negyed vs. fél hang megkülönböztetése. **A jelenlegi megvalósításban a negyed üres feje tényleg félhangnak tűnik – dönteni kell.**
- [ ] Az átlós felezés színkiosztása (fent felső hang, lent alsó hang) jó-e így?
- [ ] Színes fejek körvonala – kell-e?
