# Riff Cells — Guitar Improvisation Tool (embed build)

The tool only — no landing copy. Deploy to Vercel, then iframe it into a WordPress
page where you write the heading and body copy (so that copy ranks for your WordPress URL).

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this folder to a GitHub repo (delete `node_modules` first; `.gitignore` excludes it).
2. Vercel → Add New → Project → import the repo. It auto-detects Vite. Deploy.

## Embed in WordPress (Kadence)
Add a Custom HTML block and paste:

```html
<iframe
  src="https://YOUR-APP.vercel.app/"
  title="Guitar Improvisation Tool"
  loading="lazy"
  style="width:100%; max-width:600px; height:880px; border:0; display:block; margin:0 auto;"
></iframe>
```

Write your real H1 / intro / "how to use" / "why it works" copy in WordPress around the
iframe. The tool page is set to `noindex` so it won't compete with your WordPress page.
Adjust the iframe `height` if you see scrollbars or extra whitespace.
