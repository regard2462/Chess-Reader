// What the Linux and the macOS package share: the staged app (dist/stage: the main process, the built page as web/,
// the assets), the copyright line and the note on the source code. build/package-win.js stages the same way.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const stage = path.join(dist, 'stage');
const pkg = require(path.join(root, 'package.json'));
const COPYRIGHT = '© Chess Reader contributors, AGPL-3.0-or-later';
// where the source code of a release is: an archive of it comes with every release (no address goes into the packages)
const SOURCE_NOTE = [
  'Quellcode: Zu jeder Veröffentlichung gibt es das Quellcode-Archiv dieser Version.',
  'Source code: the source archive comes with each release.',
];

/** dist/stage: electron/main.js, the page (dist/reader) as web/, the assets and a runtime package.json. */
function makeStage() {
  if (!fs.existsSync(path.join(dist, 'reader', 'index.html'))) throw new Error('no web build in dist/reader, run `npm run build` first');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'electron'), { recursive: true });
  fs.copyFileSync(path.join(root, 'electron', 'main.js'), path.join(stage, 'electron', 'main.js'));
  fs.cpSync(path.join(dist, 'reader'), path.join(stage, 'web'), { recursive: true });
  fs.cpSync(path.join(root, 'assets'), path.join(stage, 'assets'), { recursive: true });
  // desktopName: the launcher entry of the Linux package, which Electron names to the desktop so that the window and
  // the menu entry belong together
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
    name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, main: pkg.main,
    author: pkg.author, license: pkg.license, desktopName: 'chess-reader.desktop', private: true,
  }, null, 2));
  fs.copyFileSync(path.join(dist, 'reader', 'THIRD_PARTY_LICENSES.txt'), path.join(stage, 'THIRD_PARTY_LICENSES.txt'));
  return stage;
}

const electronVersion = () => require(path.join(root, 'node_modules', 'electron', 'package.json')).version;

module.exports = { root, dist, stage, pkg, COPYRIGHT, SOURCE_NOTE, makeStage, electronVersion };
