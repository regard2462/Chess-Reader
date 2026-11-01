// Builds the browser version into dist/web/: a static site with relative addresses that runs from any static host
// (http://localhost counts as a secure context, which the folder picker needs). `node build/web.js` or `npm run build:web`.
// The desktop build (build/bundle.js, build/vendor.js) is untouched by this; the two share the sources.
//   dist/web/index.html, theme-boot.js, styles/, data/   as in app/
//   dist/web/vendor/                                     fonts (latin only), chessground, stockfish, foliate-js
//   dist/web/dist/                                       the bundle: app.js (app/src/main-web.js) and the workers
// Left out on purpose: the TTS workers and their models (Kokoro, Piper, espeak-ng, onnxruntime: hundreds of MB), the
// indexer and full-text windows of the desktop, the source maps.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = path.join(root, 'app');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'dist', 'reader');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const quiet = process.argv.includes('--quiet');

function copy(src, dst, filter = null) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true, filter: filter ? (s) => filter(s) : undefined });
}
function sizeOf(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  let n = 0;
  for (const e of fs.readdirSync(p)) n += sizeOf(path.join(p, e));
  return n;
}
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

// ---- vendor: the parts the renderer loads unbundled, without the speech models --------------------------------------
function vendor() {
  const v = path.join(out, 'vendor');
  // fonts: only the latin and latin-ext files of the weights the UI uses, and a fonts.css that names only them
  const fonts = {
    'eb-garamond': ['400', '400-italic', '500', '600', '700'],
    'cormorant-garamond': ['400', '400-italic', '500', '600', '700'],
    caveat: ['400', '500', '600', '700'],
    vt323: ['400'],
    'playfair-display': ['400', '400-italic', '700', '900'],
  };
  // only the latin ranges and only woff2 (every browser of the web build reads it): a quarter of the desktop's fonts
  const LATIN = /-(latin|latin-ext)-/;
  const fontCss = [];
  for (const [name, weights] of Object.entries(fonts)) {
    const src = path.join(nm, '@fontsource', name);
    if (!fs.existsSync(src)) { console.warn('WARNING: font missing', name); continue; }
    const dst = path.join(v, 'fonts', name);
    copy(path.join(src, 'files'), path.join(dst, 'files'), (s) => fs.statSync(s).isDirectory() || (LATIN.test(path.basename(s)) && s.endsWith('.woff2')));
    for (const w of weights) {
      const f = path.join(src, `${w}.css`);
      if (!fs.existsSync(f)) continue;
      // one @font-face block per unicode range: keep the blocks whose file we copied, without their woff fallback
      const blocks = fs.readFileSync(f, 'utf8').split(/(?=\/\* [a-z-]+ \*\/\s*@font-face)/g).filter((b) => /@font-face/.test(b));
      const kept = blocks.filter((b) => LATIN.test(b)).map((b) => b.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, ''));
      fs.mkdirSync(dst, { recursive: true });
      fs.writeFileSync(path.join(dst, `${w}.css`), kept.join('\n'));
      fontCss.push(`@import url("./${name}/${w}.css");`);
    }
  }
  fs.writeFileSync(path.join(v, 'fonts', 'fonts.css'), fontCss.join('\n') + '\n');
  // chessground assets (CSS + piece SVGs)
  copy(path.join(nm, 'chessground', 'assets'), path.join(v, 'chessground'));
  // Leaflet's stylesheet (the world map; the script is bundled)
  copy(path.join(nm, 'leaflet', 'dist', 'leaflet.css'), path.join(v, 'leaflet', 'leaflet.css'));
  // stockfish lite single-threaded engine (loaded only when the chess engine is asked for)
  for (const f of ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']) copy(path.join(nm, 'stockfish', 'bin', f), path.join(v, 'stockfish', f));
  // foliate-js (EPUB/MOBI/AZW3/FB2/CBZ + pdf.js) ships in vendor-src/
  const foliate = path.join(root, 'vendor-src', 'foliate-js');
  if (fs.existsSync(foliate)) copy(foliate, path.join(v, 'foliate-js'), (s) => !/[\\/](\.git|rollup\.config\.js|eslint\.config\.js|package\.json|reader\.html|reader\.js|ui)$/.test(s) && !/[\\/]ui[\\/]/.test(s));
  else console.warn('WARNING: vendor-src/foliate-js is missing - EPUB/PDF reading will not work.');
}

// ---- the bundle ----------------------------------------------------------------------------------------------------
const WEB_SWAPS = [
  // the backend helpers of the desktop that the bundled wiki/dict/classify modules require
  { test: /[\\/]feeds[\\/]common(\.js)?$/, to: path.join(app, 'src', 'web', 'common-web.js'), when: () => true },
  // the browser's speech output in place of the local voices
  { test: /(^|[\\/])tts-client\.js$/, to: path.join(app, 'src', 'ui', 'reader', 'tts-client-web.js'), when: (args) => !/tts-client-web\.js$/.test(args.importer) },
];
// node's `path` for the bundled backend modules; hls.js is only for the Mediathek's streams, which the browser version
// has not (2.8 MB that would never load)
const NODE_STUBS = { path: path.join(app, 'src', 'web', 'path-stub.js'), 'hls.js': path.join(app, 'src', 'web', 'hls-stub.js'), 'hls.js/dist/hls.js': path.join(app, 'src', 'web', 'hls-stub.js') };
const webPlugin = {
  name: 'chess-reader-web',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      if (NODE_STUBS[args.path]) return { path: NODE_STUBS[args.path] };
      // relative requires ('./common') are tested as the file they name
      const full = /^\.\.?[\\/]/.test(args.path) ? path.resolve(args.resolveDir, args.path) : args.path;
      for (const s of WEB_SWAPS) if (s.test.test(full) && s.when(args)) return { path: s.to };
      return null;
    });
  },
};

async function bundle() {
  const entries = {
    app: 'app/src/reader-main.js',                              // the reader, with the backend of the page
    'chess-worker': 'app/src/workers/stockfish-worker.js',
    'diagram-worker': 'app/src/workers/diagram-worker.js',     // chess diagrams on night pages and the lasso (reader)
  };
  const texturesHash = 'none';
  const result = await esbuild.build({
    entryPoints: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, path.join(root, v)])),
    outdir: path.join(out, 'dist'),
    bundle: true,
    format: 'esm',
    splitting: true,
    sourcemap: false,
    minify: false,
    platform: 'browser',
    target: ['chrome110', 'firefox115', 'safari16.4'],
    logLevel: quiet ? 'warning' : 'info',
    metafile: true,
    external: ['../vendor/*', './vendor/*', '/vendor/*'],
    loader: { '.glsl': 'text', '.vert': 'text', '.frag': 'text', '.wgsl': 'text', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"', COZYSHELVES_VERSION: JSON.stringify(pkg.version), COZYSHELVES_TEXTURES: JSON.stringify(texturesHash) },
    plugins: [webPlugin],
  });
  // the modules of the desktop that must never be in the page
  const forbidden = Object.keys(result.metafile.inputs).filter((f) => /kokoro|onnxruntime|piper-wasm|tts-worker|piper-worker|kokoro-de-worker|jsdom|rss-parser|electron[\\/]main\.js/.test(f));
  if (forbidden.length) throw new Error('desktop-only code in the web bundle: ' + forbidden.join(', '));
  return result;
}

// ---- the page --------------------------------------------------------------------------------------------------------
function page() {
  let html = fs.readFileSync(path.join(app, 'reader.html'), 'utf8');
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">\n  <meta name="color-scheme" content="light dark">\n  <link rel="manifest" href="./manifest.webmanifest">\n  <link rel="icon" href="./icon.png" type="image/png">\n  <meta name="theme-color" content="#e3dccf">');
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.copyFileSync(path.join(app, 'theme-boot.js'), path.join(out, 'theme-boot.js'));
  copy(path.join(app, 'styles'), path.join(out, 'styles'));
  copy(path.join(app, 'data'), path.join(out, 'data'));
  for (const f of ['icon.png', 'icon-512.png']) if (fs.existsSync(path.join(root, 'assets', f))) fs.copyFileSync(path.join(root, 'assets', f), path.join(out, f));
  // a web app manifest: "add to home screen" on a phone gives a full-screen page (the Android app is another matter)
  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
    name: 'Chess Reader', short_name: 'Chess Reader', description: pkg.description, start_url: './index.html', scope: './', display: 'standalone',
    background_color: '#e3dccf', theme_color: '#e3dccf', icons: [{ src: './icon.png', sizes: '256x256', type: 'image/png' }, { src: './icon-512.png', sizes: '512x512', type: 'image/png' }],
  }, null, 2));
  // a static host that knows nothing about the files: the types it needs (GitHub Pages and the like know them anyway)
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
}

// ---- the licenses: Cozy Shelves (AGPL-3.0-or-later) and the third-party components of this build ---------------------
function licenses(bundled) {
  const thirdParty = require('./third-party');
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'COPYING.txt'));
  fs.copyFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(out, 'THIRD_PARTY_NOTICES.md'));
  fs.writeFileSync(path.join(out, 'THIRD_PARTY_LICENSES.txt'), thirdParty.fullText(thirdParty.collect({ bundled })));
}

(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  vendor();
  const result = await bundle();
  page();
  licenses(Object.keys(result.metafile.inputs).map((f) => path.resolve(f)));
  const parts = ['dist', 'vendor/fonts', 'vendor/foliate-js', 'vendor/stockfish', 'vendor/chessground', 'styles', 'data'].map((p) => [p, sizeOf(path.join(out, p))]);
  const total = sizeOf(out);
  const info = { version: pkg.version, builtAt: new Date().toISOString(), bytes: total, parts: Object.fromEntries(parts) };
  fs.writeFileSync(path.join(out, 'build-info.json'), JSON.stringify(info, null, 2));
  console.log(`reader build ${pkg.version} → ${out}`);
  for (const [p, n] of parts) console.log(`  ${p.padEnd(20)} ${mb(n)}`);
  console.log(`  ${'total'.padEnd(20)} ${mb(total)}`);
})().catch((e) => { console.error(e); process.exit(1); });
