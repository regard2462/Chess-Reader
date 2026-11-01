// Builds the portable Windows package: dist/ChessReader-win64/ and dist/ChessReader-<version>-win64-portable.zip.
// @electron/packager (asar off) puts the main process and the built page (dist/reader, as web/) together; resedit sets
// the icon and the version info. Run `npm run build` first.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const pkg = require(path.join(root, 'package.json'));
const COPYRIGHT = '© Chess Reader contributors, AGPL-3.0-or-later';

(async () => {
  const stage = path.join(dist, 'stage');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'electron'), { recursive: true });
  fs.copyFileSync(path.join(root, 'electron', 'main.js'), path.join(stage, 'electron', 'main.js'));
  fs.cpSync(path.join(dist, 'reader'), path.join(stage, 'web'), { recursive: true });
  fs.cpSync(path.join(root, 'assets'), path.join(stage, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, main: pkg.main, author: pkg.author, license: pkg.license, private: true }, null, 2));
  const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
  const { packager } = require('@electron/packager');
  const [outDir] = await packager({ dir: stage, out: dist, platform: 'win32', arch: 'x64', electronVersion, asar: false, overwrite: true, prune: false, name: 'ChessReader', executableName: 'ChessReader', appVersion: pkg.version, appCopyright: COPYRIGHT, ignore: [/\.git/] });
  try {
    const resedit = require('resedit');
    const exePath = path.join(outDir, 'ChessReader.exe');
    const exe = resedit.NtExecutable.from(fs.readFileSync(exePath));
    const res = resedit.NtExecutableResource.from(exe);
    const iconFile = resedit.Data.IconFile.from(fs.readFileSync(path.join(root, 'assets', 'icon.ico')));
    resedit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, iconFile.icons.map((i) => i.data));
    const vi = resedit.Resource.VersionInfo.fromEntries(res.entries)[0] || resedit.Resource.VersionInfo.createEmpty();
    const ver = pkg.version.split('.').map((n) => parseInt(n) || 0);
    vi.setFileVersion(ver[0], ver[1], ver[2], 0, 1033); vi.setProductVersion(ver[0], ver[1], ver[2], 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: pkg.productName, FileDescription: pkg.productName + ', an e-reader', CompanyName: 'Chess Reader contributors', LegalCopyright: COPYRIGHT, OriginalFilename: 'ChessReader.exe', InternalName: 'ChessReader' });
    vi.outputToResourceEntries(res.entries);
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  } catch (e) { console.warn('resedit failed (icon not set):', e.message); }
  fs.writeFileSync(path.join(outDir, 'START.txt'), [
    'Chess Reader starten: ChessReader.exe doppelklicken. Anleitung: README.md',
    'Start Chess Reader: double-click ChessReader.exe. Guide: README.md',
    '',
    'Chess Reader ist freie Software unter der GNU Affero General Public License, Version 3 oder neuer (COPYING.txt).',
    'Chess Reader is free software under the GNU Affero General Public License, version 3 or later (COPYING.txt).',
    'Third-party components: THIRD_PARTY_NOTICES.md, THIRD_PARTY_LICENSES.txt',
    '',
  ].join('\r\n'));
  fs.copyFileSync(path.join(root, 'README.md'), path.join(outDir, 'README.md'));
  fs.copyFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(outDir, 'THIRD_PARTY_NOTICES.md'));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(outDir, 'COPYING.txt'));
  fs.copyFileSync(path.join(dist, 'reader', 'THIRD_PARTY_LICENSES.txt'), path.join(outDir, 'THIRD_PARTY_LICENSES.txt'));
  const finalDir = path.join(dist, 'ChessReader-win64');
  fs.rmSync(finalDir, { recursive: true, force: true });
  fs.renameSync(outDir, finalDir);
  const zipName = `ChessReader-${pkg.version}-win64-portable.zip`;
  fs.rmSync(path.join(dist, zipName), { force: true });
  const ps = path.join(dist, '_zip.ps1');
  fs.writeFileSync(ps, `Compress-Archive -Path "${finalDir}" -DestinationPath "${path.join(dist, zipName)}" -CompressionLevel Optimal -Force\n`);
  execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps}"`, { stdio: 'inherit' });
  fs.rmSync(ps, { force: true });
  console.log('ZIP:', path.join(dist, zipName), (fs.statSync(path.join(dist, zipName)).size / 1e6).toFixed(1), 'MB');
})().catch((e) => { console.error(e); process.exit(1); });
