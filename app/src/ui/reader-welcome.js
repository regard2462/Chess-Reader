// The first card of Chess Reader: asks for a folder with books. The files stay where they are.
import { h } from '../core/dom.js';
import { tr } from '../core/i18n.js';

const TEXT = {
  title: { de: 'Willkommen in Chess Reader', en: 'Welcome to Chess Reader' },
  lead: {
    de: 'Chess Reader liest die Bücher auf deinem Rechner, etwa PDF-, EPUB- und MOBI-Dateien. Wähle einen Ordner mit Büchern. Die Dateien bleiben, wo sie sind.',
    en: 'Chess Reader reads the books on your computer, such as PDF, EPUB and MOBI files. Choose a folder with books. The files stay where they are.',
  },
  chess: {
    de: 'In Schachbüchern setzt der Auswahlrahmen (Taste D) ein Diagramm auf das Brett.',
    en: 'In chess books the selection frame (key D) puts a diagram on the board.',
  },
  choose: { de: 'Ordner mit Büchern wählen', en: 'Choose a folder with books' },
  choosing: { de: 'Ordner wird gewählt …', en: 'Choosing a folder …' },
  later: { de: 'Später', en: 'Later' },
  web: { de: 'Die Bücher bleiben auf deinem Rechner. Lesezeichen und Leseposition merkt sich dieses Programm.', en: 'The books stay on your computer. Bookmarks and reading positions are kept by this program.' },
  failed: { de: 'Der Ordner konnte nicht hinzugefügt werden.', en: 'The folder could not be added.' },
};

export async function mount(container, ctx) {
  let busy = false;
  container.classList.add('welcome-layer');
  const card = h('div.panel.welcome-card', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title' });
  container.appendChild(card);
  let chooseBtn = null;

  const choose = async () => {
    if (busy) return;
    busy = true; render();
    let folders = null;
    try { folders = await ctx.api.library.addFolder('structured'); }
    catch (e) { console.warn('[welcome] addFolder', e); ctx.toast?.(tr(TEXT.failed)); }
    busy = false;
    if (!card.isConnected) return;
    if (!folders || !folders.length) { render(); return; }
    if (ctx.state?.settings) ctx.state.settings.folders = folders;
    ctx.bus.emit('welcome:folder', folders);
    ctx.close();
  };

  function render() {
    card.textContent = '';
    const lang = ctx.i18n?.lang || 'de';
    chooseBtn = h('button.btn.primary.wel-choose', { type: 'button', disabled: busy, onclick: choose }, busy ? tr(TEXT.choosing) : [tr(TEXT.choose), h('kbd', 'Enter')]);
    card.append(
      h('h2.wel-title#welcome-title', tr(TEXT.title)),
      h('p.wel-lead', tr(TEXT.lead)),
      h('p.wel-lead', tr(TEXT.chess)),
      h('div.wel-actions', chooseBtn, h('button.btn.wel-later', { type: 'button', disabled: busy, onclick: () => ctx.close() }, tr(TEXT.later), h('kbd', 'Esc'))),
      h('p.wel-note.wel-web', tr(TEXT.web)),
      h('div.wel-lang', { role: 'group' },
        ...[['de', 'Deutsch'], ['en', 'English']].map(([k, label]) => h('button.btn.small', { type: 'button', class: lang === k ? 'primary' : 'ghost', lang: k,
          onclick: () => { if ((ctx.i18n?.lang || 'de') !== k) ctx.api.settings.set({ language: k }).catch(() => {}); } }, label))));
  }
  render();
  requestAnimationFrame(() => chooseBtn?.focus({ preventScroll: true }));
  const offLang = ctx.bus.on('i18n:change', render);
  return {
    unmount() { offLang?.(); container.classList.remove('welcome-layer'); },
    onKey(e) {
      if (e.key === 'Escape') { if (!busy) ctx.close(); return true; }
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { choose(); return true; }
      return false;
    },
  };
}
