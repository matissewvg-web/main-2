// Bouwt één zelfstandig bestand (frontlinie.html) uit de modules in src/: geen server, geen installatie.
// De modules gebruiken alleen benoemde imports/exports, dus samenvoegen = regels strippen en in volgorde plakken.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const volgorde = ['rng', 'geo', 'europa-geo', 'kaarten', 'campagnes', 'doctrines', 'scenario', 'tafel', 'engine', 'ui-kaart', 'ui-verf', 'ui-blad', 'ui'];
const namen = new Map();
let js = '';
for (const m of volgorde) {
  let code = readFileSync(join(hier, 'src', m + '.js'), 'utf8');
  code = code.replace(/^import\s[^;]*?from\s+'[^']+';\s*$/gm, '').replace(/^export\s+/gm, '');
  for (const hit of code.matchAll(/^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (namen.has(hit[1])) throw new Error(`Naam "${hit[1]}" staat in ${namen.get(hit[1])}.js en ${m}.js: hernoem er één.`);
    namen.set(hit[1], m);
  }
  js += `\n// ── ${m}.js ──\n${code}`;
}
const css = readFileSync(join(hier, 'src', 'stijl.css'), 'utf8');
const kop = `<title>Frontlinie</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Saira+Condensed:wght@600;700&display=swap">
<style>\n${css}</style>`;
const lijf = `<div id="app"></div>\n<script>\n(function () {\n'use strict';${js}\nstartApp(document.getElementById('app'));\n})();\n</script>`;
writeFileSync(join(hier, 'frontlinie.html'), `<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${kop}\n</head>\n<body>\n${lijf}\n</body>\n</html>\n`);
if (process.argv[2]) writeFileSync(process.argv[2], `${kop}\n${lijf}\n`); // variant zonder html/head/body, voor publicatie als pagina
console.log(`frontlinie.html: ${Math.round((kop.length + lijf.length) / 1024)} kB, ${volgorde.length} modules`);
