import { build } from 'esbuild'; import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, write: false, format: 'iife', outdir: 'out' });
const css = await build({ entryPoints: ['src/app.css'], minify: true, write: false, outdir: 'out' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script'), st = css.outputFiles[0].text;
const html = readFileSync('src/index.html', 'utf8').replace('/*CSS*/', () => st).replace('/*JS*/', () => js);
mkdirSync('dist', { recursive: true }); writeFileSync('dist/index.html', html); console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
