# Riff Cells — Guitar Improvisation Tool

A free guitar improvisation trainer. Deals a random five-note cell over any root and
chord quality, with a built-in drone to play against. Built with Vite + React.

## Run locally
```bash
npm install
npm run dev
```
Then open the URL Vite prints (usually http://localhost:5173).

## Deploy to Vercel
1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project → Import** your repo.
3. Vercel auto-detects Vite. Framework preset: **Vite**. Build command `npm run build`,
   output dir `dist`. Click **Deploy**. No other settings needed.

## Before you push
- Delete `node_modules` if it's present (Vercel rebuilds it). `.gitignore` already excludes it.
- Edit the SEO block in `index.html` (title, meta description) and replace
  `YOUR-DOMAIN-HERE` in the canonical / og tags.
- In `src/LandingPage.jsx`, replace the opt-in placeholder block with your
  EmailOctopus form embed (EmailOctopus → Forms → Embed).

## Files
- `index.html` — page shell, SEO tags, fonts
- `src/LandingPage.jsx` — hero, prose sections, opt-in (all the copy lives here)
- `src/RiffCells.jsx` — the tool itself
- `src/main.jsx`, `src/styles.css` — entry point and global styles

## Embedding into WordPress (Kadence)
Once deployed, the page lives at your Vercel URL (e.g. https://riff-cells.vercel.app).
To drop it inside a WordPress page, add a Custom HTML / HTML block and paste the iframe
from `EMBED.md`. For best results, point a subdomain (e.g. tools.unlocktheguitar.net) at
the Vercel deployment and embed that.
