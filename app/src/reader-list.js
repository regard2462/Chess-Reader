// The book list of Chess Reader: a grid of covers with search, a sort order and the button for the books folder.
import { h, clear } from './core/dom.js';
import { tr } from './core/i18n.js';

const SORTS = {
  recent: { label: { de: 'Zuletzt gelesen', en: 'Recently read' }, cmp: (a, b) => (b.lastOpened || 0) - (a.lastOpened || 0) },
  title: { label: { de: 'Titel', en: 'Title' }, cmp: (a, b) => String(a.title).localeCompare(String(b.title)) },
  author: { label: { de: 'Autor', en: 'Author' }, cmp: (a, b) => String(a.author || '￿').localeCompare(String(b.author || '￿')) },
};

export function listView(container, ctx) {
  const { api, bus } = ctx;
  let books = [];
  let query = '';
  let sort = 'recent';
  let scan = null;

  const search = h('input.rl-search', { type: 'search', placeholder: tr({ de: 'Bücher suchen', en: 'Search books' }), oninput: (e) => { query = e.target.value; draw(); } });
  const sortSel = h('select.rl-sort', { onchange: (e) => { sort = e.target.value; draw(); } });
  const fillSorts = () => { clear(sortSel); for (const [k, v] of Object.entries(SORTS)) sortSel.append(h('option', { value: k, selected: k === sort }, tr(v.label))); };
  fillSorts();
  const addBtn = h('button.btn.primary', { onclick: () => ctx.openPanel('welcome') });
  const labels = () => { addBtn.textContent = tr({ de: 'Ordner hinzufügen', en: 'Add folder' }); search.placeholder = tr({ de: 'Bücher suchen', en: 'Search books' }); fillSorts(); };
  const status = h('span.rl-status');
  const grid = h('div.rl-grid');
  const empty = h('div.rl-empty');
  container.append(
    h('header.rl-bar',
      h('h1.rl-title', 'Chess Reader'),
      search, sortSel, status,
      addBtn),
    empty, grid);
  labels();

  function visible() {
    const q = query.trim().toLowerCase();
    const list = q ? books.filter((b) => `${b.title} ${b.author || ''}`.toLowerCase().includes(q)) : books.slice();
    if (sort === 'recent') {
      const opened = list.filter((b) => b.lastOpened).sort(SORTS.recent.cmp);
      return opened.concat(list.filter((b) => !b.lastOpened).sort(SORTS.title.cmp));
    }
    return list.sort(SORTS[sort].cmp);
  }

  function card(b) {
    const url = api.library.coverUrl?.(b.id);
    const pct = b.progress > 0 ? Math.round(Math.min(1, b.progress) * 100) : 0;
    return h('button.rl-card', { type: 'button', title: b.title, onclick: () => bus.emit('book:open', { id: b.id }) },
      h('div.rl-cover', url ? h('img', { src: url, alt: '', loading: 'lazy' }) : h('div.rl-nocover', h('span', b.title))),
      pct ? h('div.rl-progress', h('div', { style: `width:${pct}%` })) : null,
      h('div.rl-name', b.title),
      b.author ? h('div.rl-author', b.author) : null);
  }

  function draw() {
    const list = visible();
    clear(grid);
    for (const b of list) grid.append(card(b));
    empty.textContent = books.length ? (list.length ? '' : tr({ de: 'Keine Treffer.', en: 'No matches.' }))
      : tr({ de: 'Noch keine Bücher. Mit „Ordner hinzufügen“ einen Ordner mit Büchern wählen.', en: 'No books yet. Choose a folder with books under “Add folder”.' });
    status.textContent = scan?.active ? tr({ de: 'Lese Bücher ein …', en: 'Reading books …' }) + ` ${scan.done || 0}/${scan.total || 0}` : books.length ? `${books.length}` : '';
  }

  async function refresh() {
    const s = await api.library.getState();
    books = s.books || [];
    scan = s.scan;
    draw();
  }

  api.library.onUpdate((s) => { books = s.books || []; scan = s.scan; draw(); });
  api.library.onScan?.((s) => { scan = s; draw(); });
  bus.on('i18n:change', () => { labels(); draw(); });
  bus.on('welcome:folder', () => refresh());
  refresh().then(() => { if (!books.length && !(ctx.state.settings.folders || []).length) ctx.openPanel('welcome'); });
  return { refresh };
}
