# Cart Ring

Shopping support PWA — see how much of your budget is left while you shop.

- Type amounts in thousands of won: `36` → 36,000, `35.5` → 35,500.
- Name → Next → Amount → Done adds the item and jumps back to Name.
- Swipe an item left to delete; tap it to edit.
- Everything is stored on the phone (localStorage); works offline after the first visit.

Plain HTML/CSS/JS, no build step. Files: `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icons/`.
When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.
