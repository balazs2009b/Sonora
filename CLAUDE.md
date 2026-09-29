# Sonora

Olvasd el a `SPEC.md`-t minden munka előtt – ott vannak a döntések és a nyitott kérdések.

- Kommunikáció magyarul.
- A tulajdonos Claude Pro kerettel dolgozik: kis, lezárt lépések, tömör válaszok.
- Minden új döntést vezess át a `SPEC.md`-be.

## Parancsok
- `npm install` – függőségek
- `npm run dev` – fejlesztői szerver
- `npm test` – egységtesztek (vitest)
- `npm run build` – típusellenőrzés + egyetlen offline `dist/index.html`

## Felépítés
- `src/colors.ts` – színrendszer (hangmagasság → szín)
- `src/score.ts` – Verovio: betöltés, transzponálás, megszólaló hangok, SVG oldalak
- `src/noteheads.ts` – kottafejek átszínezése (fekete / színes / kifestős)
- `src/main.ts` – felhasználói felület
- `public/` – PWA: `sw.js` (offline + frissítés), manifest, ikonok
- `samples/` – próba kották

## Hosting
GitHub Pages: https://balazs2009b.github.io/Sonora/ – a `main` ágról automatikusan (`.github/workflows/pages.yml`). PR-eken csak teszt + build fut.
