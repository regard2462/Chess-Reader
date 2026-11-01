// Builds the Android app: the web build (build/reader.js, dist/reader) goes into the assets of android/app, Gradle makes the APKs,
// and they land in dist/android/. `node build/android.js` or `npm run build:android`.
//   --debug          only the debug APK (the default builds debug and release)
//   --release        only the release APK (signed when a key is configured, see android/app/build.gradle.kts)
//   --no-web         keep the web build that is there (dist/reader) instead of building it again
//   --copy <dir>     build from a copy of android/ in <dir> (the Android Gradle plugin fails on paths with
//                    characters outside ASCII; the default copies only when the repository path has one)
//   --task <name>    a Gradle task of your own instead of assemble*, for example :app:lint
//   --offline        Gradle without the network (everything from its caches)
// Needs JDK 17 (JAVA_HOME or the JDK on the PATH) and the Android SDK (ANDROID_HOME, ANDROID_SDK_ROOT or
// %LOCALAPPDATA%\Android\Sdk); the Gradle wrapper downloads Gradle itself the first time.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const web = path.join(root, 'dist', 'reader');
const out = path.join(root, 'dist', 'android');

function run(cmd, cmdArgs, cwd, env) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...(env || {}) } });
  if (r.status !== 0) { console.error(`\n${cmd} ${cmdArgs.join(' ')} failed (${r.status})`); process.exit(r.status || 1); }
}
function sdkHome() {
  for (const c of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), path.join(os.homedir(), 'Android', 'Sdk'), path.join(os.homedir(), 'Library', 'Android', 'sdk')]) {
    if (c && fs.existsSync(path.join(c, 'platform-tools'))) return c;
  }
  return null;
}
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

// ---- 1. the web build ----------------------------------------------------------------------------------------------
if (!flag('--no-web') || !fs.existsSync(path.join(web, 'index.html'))) run('node', [path.join(root, 'build', 'reader.js'), '--quiet'], root);
if (!fs.existsSync(path.join(web, 'index.html'))) { console.error('no web build in ' + web); process.exit(1); }

// ---- 2. the project folder: the repository's android/ or a copy on an ASCII path --------------------------------------
let project = path.join(root, 'android');
const copyTo = opt('--copy') || (/[^\x20-\x7e]/.test(project) ? path.join(os.tmpdir(), 'cr-android') : null);
if (copyTo) {
  console.log('copying android/ to ' + copyTo + ' (the Android Gradle plugin needs an ASCII path)');
  fs.rmSync(copyTo, { recursive: true, force: true });
  fs.mkdirSync(copyTo, { recursive: true });
  fs.cpSync(project, copyTo, { recursive: true, filter: (s) => !/[\\/](\.gradle|build|\.idea|\.kotlin)$/.test(s) && !/[\\/]app[\\/]build([\\/]|$)/.test(s) });
  // app/build.gradle.kts reads ../../package.json for the version
  fs.copyFileSync(path.join(root, 'package.json'), path.join(path.dirname(copyTo), 'package.json'));
  project = copyTo;
}
const assets = path.join(project, 'app', 'src', 'main', 'assets', 'web');
fs.rmSync(assets, { recursive: true, force: true });
fs.mkdirSync(path.dirname(assets), { recursive: true });
fs.cpSync(web, assets, { recursive: true });
console.log(`web build ${pkg.version} copied into the assets`);

// ---- 3. Gradle ---------------------------------------------------------------------------------------------------------
const tasks = opt('--task') ? [opt('--task')] : flag('--debug') ? [':app:assembleDebug'] : flag('--release') ? [':app:assembleRelease'] : [':app:assembleDebug', ':app:assembleRelease'];
const env = {};
const sdk = sdkHome();
if (sdk && !process.env.ANDROID_HOME) env.ANDROID_HOME = sdk;
if (!process.env.JAVA_HOME) {
  const jdk = ['C:/Program Files/Eclipse Adoptium', 'C:/Program Files/Java', 'C:/Program Files/Microsoft'].flatMap((d) => { try { return fs.readdirSync(d).filter((n) => /jdk-?17/i.test(n)).map((n) => path.join(d, n)); } catch { return []; } })[0];
  if (jdk) env.JAVA_HOME = jdk;
}
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(path.join(project, wrapper), [...tasks, ...(flag('--offline') ? ['--offline'] : []), '--no-daemon', '-q', '--console=plain', '--warning-mode=none'], project, env);

// ---- 4. the APKs into dist/android ------------------------------------------------------------------------------------
fs.mkdirSync(out, { recursive: true });
const apks = [];
for (const variant of ['debug', 'release']) {
  const dir = path.join(project, 'app', 'build', 'outputs', 'apk', variant);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.apk'))) {
    const name = `chess-reader-${pkg.version}-${variant}${/unsigned/.test(f) ? '-unsigned' : ''}.apk`;
    fs.copyFileSync(path.join(dir, f), path.join(out, name));
    apks.push([name, fs.statSync(path.join(out, name)).size]);
  }
}
if (!apks.length) { console.error('no APK was built'); process.exit(1); }
console.log('APKs in ' + out);
for (const [n, s] of apks) console.log(`  ${n.padEnd(44)} ${mb(s)}`);

// ---- 5. the signature of the release APK: apksigner verify (build-tools of the SDK) -----------------------------------
const release = apks.find(([n]) => /-release\.apk$/.test(n));
if (release && sdk) {
  const bt = path.join(sdk, 'build-tools');
  const versions = fs.existsSync(bt) ? fs.readdirSync(bt).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse() : [];
  const signer = versions.map((v) => path.join(bt, v, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner')).find((f) => fs.existsSync(f));
  if (signer) {
    const r = spawnSync(signer, ['verify', '--verbose', '--print-certs', path.join(out, release[0])], { encoding: 'utf8', shell: process.platform === 'win32' });
    console.log((r.stdout || '').split('\n').filter((l) => !/SHA-1|SHA-256 digest of public key|Signer #1 certificate DN/.test(l) || /SHA-256 digest/.test(l)).join('\n').trim());
    if (r.status !== 0) { console.error('apksigner verify failed: ' + String(r.stderr || r.stdout).trim().split('\n').slice(0, 3).join(' ')); process.exit(1); }
  } else console.warn('apksigner not found in ' + bt + ', the signature was not checked');
}
