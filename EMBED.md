# Embedding the tool in WordPress / Kadence

After deploying to Vercel, copy your live URL and use one of the options below.

## Option A — Embed just the tool (recommended for an existing WordPress page)
Build a tool-only version (no landing copy) by rendering `RiffCells` instead of
`LandingPage` in `src/main.jsx`, deploy that, then iframe it into a page where you've
written the surrounding copy in WordPress:

```html
<iframe
  src="https://YOUR-APP.vercel.app/"
  title="Guitar Improvisation Tool"
  loading="lazy"
  style="width:100%; max-width:600px; height:900px; border:0; display:block; margin:0 auto;"
></iframe>
```

## Option B — Embed the whole landing page
If you want the full page (hero, prose, opt-in) inside WordPress as-is:

```html
<iframe
  src="https://YOUR-APP.vercel.app/"
  title="Guitar Improvisation Tool"
  loading="lazy"
  style="width:100%; height:1800px; border:0; display:block;"
></iframe>
```

## Notes
- Fixed-height iframes can leave whitespace or cut off on mobile. If that bugs you,
  add the `iframe-resizer` library later so the frame auto-fits its content.
- **SEO reality check:** content inside an iframe is credited to the iframe's URL, not
  your WordPress page. So if ranking is the goal, write the real heading and body copy
  *in WordPress* (Option A) and iframe only the interactive tool. Don't bury the words
  you want to rank for inside the frame.
- Host the Vercel app on a subdomain you control (e.g. tools.unlocktheguitar.net) so it
  shares your brand and is easy to link to.
