# Sonora

Színes kotta egy gombnyomással. Kottát írhatsz benne akkordokkal, több szólammal és előadási jelekkel, vagy MusicXML kottát nyithatsz meg, és fekete, színes vagy kifestős nézetben mutatja. Transzponál, nyomtat, internet nélkül fut.

## Billentyűk
| Billentyű | Mit csinál |
|---|---|
| `C D E F G A H` | hang beírása (`B` = bé) |
| `1` – `5` | egész, fél, negyed, nyolcad, tizenhatod |
| `.` | pont (0 → 1 → 2 → 0) |
| `+` `−` `0` | kereszt, bé, feloldójel |
| `↑` `↓` | oktáv |
| `S` | szünet |
| `←` `→` | kurzor mozgatása |
| `Backspace` | törlés |
| `Ctrl+Z` / `Ctrl+Y` | vissza / újra |

## Használat
**Online:** a Vercel-címen (lásd a Vercel projekt oldalát). Chrome/Edge címsorában a „Telepítés” ikonnal appként telepíthető. Utána internet nélkül is indul, és ha van net, mindig frissül.

**Fájlként (fejlesztőknek):**
1. `npm install`
2. `npm run build`
3. Nyisd meg a `dist/index.html` fájlt a böngészőben (dupla kattintás), internet nem kell.

Finale-kottákat MusicXML-be exportálva lehet megnyitni (Finale: *Fájl → Exportálás → MusicXML*).

Részletek: [SPEC.md](SPEC.md)
