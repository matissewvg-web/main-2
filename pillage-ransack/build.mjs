// Builds index.html: app.html wrapped as a full document with engine.js inlined,
// so the map opens straight from disk with no server. Run: node pillage-ransack/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const app = readFileSync(new URL('app.html', dir), 'utf8');
const engine = readFileSync(new URL('engine.js', dir), 'utf8');

const split = app.indexOf('<div class="app">');
if (split === -1) throw new Error('app.html: <div class="app"> not found');
const head = app.slice(0, split).trim();
const body = app
  .slice(split)
  .replace('<script src="engine.js"></script>', () => '<script>\n' + engine.trim() + '\n</script>');
if (body.includes('src="engine.js"')) throw new Error('engine.js was not inlined');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- Generated from app.html and engine.js by build.mjs. Edit those, then rebuild. -->
${head}
</head>
<body>
${body.trim()}
</body>
</html>
`;
writeFileSync(new URL('index.html', dir), html);
console.log('Wrote pillage-ransack/index.html (' + Math.round(html.length / 1024) + ' KB)');
