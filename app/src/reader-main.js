// The entry of Chess Reader: the reader of Cozy Shelves (EPUB, PDF, MOBI, AZW3, FB2, CBZ, TXT, MD, HTML) with the chess
// diagram lasso, on a plain book list instead of the 3D library. The backend of the page is installed first
// (core/api-web.js), then the list is drawn and every book opens in the unchanged reader panel.
import { installWebApi } from './core/api-web.js';

const root = document.getElementById('app');
try {
  await installWebApi();
} catch (e) {
  console.error('[reader] backend failed to start', e);
  root.textContent = 'Failed to start: ' + (e?.message || e);
  throw e;
}

const { api } = await import('./core/api.js');
const { bus } = await import('./core/bus.js');
const { i18n, tr } = await import('./core/i18n.js');
const { h, clear } = await import('./core/dom.js');
const { themeOf, applyTheme, THEMES } = await import('./core/theme.js');
const { initPanels, openPanel, closePanel, dispatchPanelKey, trapTab, currentPanel } = await import('./ui/panels.js');
const { listView } = await import('./reader-list.js');

const state = { settings: await api.settings.get(), basket: [], library: null };
applyTheme(themeOf(state.settings));
i18n.setLanguage(state.settings.language || ((navigator.language || 'en').slice(0, 2) === 'de' ? 'de' : 'en'));
api.settings.onChange((s) => { state.settings = s; applyTheme(themeOf(s)); if (s.language && s.language !== i18n.lang) i18n.setLanguage(s.language); });

const toast = (msg) => {
  const el = h('div.toast', msg);
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.classList.add('fade'), 2500);
  setTimeout(() => el.remove(), 3100);
};
const ctx = { api, bus, i18n, state, toast, audio: null, world: null, openPanel: (n, p) => openPanel(n, p, ctx) };
window.__ctx = ctx;

initPanels(document.getElementById('panels'));
const view = listView(document.getElementById('list'), ctx);
bus.on('book:open', ({ id, location }) => openPanel('reader', { id, location }, ctx));
bus.on('book:open-hit', ({ id, hit }) => openPanel('reader', { id, hit }, ctx));
bus.on('book:open-external', (ext) => openPanel('reader', { external: ext }, ctx));
bus.on('reader:closed', () => view.refresh());

document.addEventListener('keydown', (e) => {
  if (trapTab(e)) return;
  if (dispatchPanelKey(e)) return;
  if (e.key === 'Escape' && currentPanel()) closePanel();
});
document.getElementById('loading')?.remove();
