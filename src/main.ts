import './style.css';
import { loadDataset, Dataset, esc } from './data';
import type { Ctx, ViewId, Filter, View } from './app';
import { initTooltip, hideTooltip } from './components/tooltip';
import { initGlossary } from './glossary';
import { mountFeedback } from './feedback';
import { openAbout } from './about';
import { openSpeciesDrawer, openStateDrawer, initDrawerKeys, closeDrawer } from './drilldown';
import { renderOverview } from './views/overview';
import { renderMap } from './views/map';
import { renderRankings } from './views/rankings';
import { renderTree } from './views/tree';
import { renderEndemism } from './views/endemism';
import { renderMatrix } from './views/matrix';
import { renderExplorer } from './views/explorer';
import { renderInsights } from './views/insights';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Map' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'tree', label: 'Tree of Life' },
  { id: 'endemism', label: 'Endemism' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'explorer', label: 'Explorer' },
  { id: 'insights', label: 'Insights' },
];

const VIEWS: Record<ViewId, View> = {
  overview: renderOverview,
  map: renderMap,
  rankings: renderRankings,
  tree: renderTree,
  endemism: renderEndemism,
  matrix: renderMatrix,
  explorer: renderExplorer,
  insights: renderInsights,
};

function parseHash(): { view: ViewId; species?: string; state?: string } {
  const h = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(h.includes('=') ? h.replace(/&/g, '&') : '');
  let view = (params.get('v') as ViewId) || 'overview';
  if (!TABS.some((t) => t.id === view)) view = 'overview';
  return { view, species: params.get('s') || undefined, state: params.get('state') || undefined };
}

function boot(data: Dataset): void {
  const app = document.getElementById('app')!;
  let pendingFilter: Filter = {};
  let currentView: ViewId = 'overview';
  let cleanup: (() => void) | void;

  app.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#v=overview">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M8 23 C11 10 20 5 26 6 C26 15 19 24 9 24 C8.6 24 8.3 23.6 8 23 Z" fill="#256848"/><path d="M9.5 23.2 C15 17 20.5 11 25.4 6.6" fill="none" stroke="#faf8f2" stroke-width="1.4" stroke-linecap="round"/></svg>
          </span>
          <span class="brand-text"><strong>Threatened Species</strong><small>Australia · EPBC Act list</small></span>
        </a>
        <nav class="tabs" id="tabs" aria-label="Views">
          ${TABS.map((t) => `<button class="tab" data-view="${t.id}" type="button">${t.label}</button>`).join('')}
        </nav>
        <button class="about-btn" id="about-btn" type="button" aria-label="About this site">?</button>
      </div>
    </header>
    <main class="main-content"><div id="view-root" class="view-root"></div></main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span class="foot-src">Source: <a href="${esc(data.meta.source.url)}" target="_blank" rel="noopener">EPBC Act threatened species list</a>, DCCEEW · extract ${esc(data.meta.extracted)}</span>
        <span class="foot-by">Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> · <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a></span>
      </div>
    </footer>
  `;

  const viewRoot = document.getElementById('view-root') as HTMLElement;

  const ctx: Ctx = {
    data,
    go: (v) => { setHashView(v); },
    openExplorer: (f) => { pendingFilter = f; setHashView('explorer'); },
    openSpecies: (id) => openSpeciesDrawer(ctx, id),
    openState: (code) => openStateDrawer(ctx, code),
    getFilter: () => pendingFilter,
  };

  const setHashView = (v: ViewId) => {
    if (location.hash.startsWith('#s=') || location.hash.startsWith('#state=')) closeDrawer();
    const target = `#v=${v}`;
    if (location.hash === target) render(v); // same hash won't fire hashchange — re-render so a new filter applies
    else location.hash = target;
  };

  const render = (view: ViewId) => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    hideTooltip();
    currentView = view;
    document.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.classList.toggle('on', t.getAttribute('data-view') === view));
    viewRoot.innerHTML = '';
    viewRoot.scrollTop = 0;
    window.scrollTo(0, 0);
    try {
      cleanup = VIEWS[view](viewRoot, ctx) || undefined;
    } catch (err) {
      viewRoot.innerHTML = `<div class="load-error"><h2>Something went wrong drawing this view.</h2><p>${esc(String(err))}</p></div>`;
    }
    // reset the pending filter after the explorer has consumed it
    if (view === 'explorer') pendingFilter = {};
  };

  const route = () => {
    const { view, species, state } = parseHash();
    if (view !== currentView || viewRoot.childElementCount === 0) render(view);
    if (species) openSpeciesDrawer(ctx, species);
    else if (state) openStateDrawer(ctx, state);
    else closeDrawer(); // plain view (or back-button) — dismiss any open drawer
  };

  document.getElementById('tabs')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('.tab');
    if (b) setHashView(b.getAttribute('data-view') as ViewId);
  });
  document.getElementById('about-btn')!.addEventListener('click', () => openAbout(data));
  window.addEventListener('hashchange', route);

  initTooltip();
  initGlossary();
  initDrawerKeys();
  route();
  mountFeedback();
}

const app = document.getElementById('app')!;
app.innerHTML = '<div class="boot">Loading Australia’s threatened species…</div>';
loadDataset()
  .then(boot)
  .catch((err) => {
    app.innerHTML = `<div class="load-error"><h2>Could not load the data.</h2><p>${esc(String(err))}</p><p>Please try again shortly.</p></div>`;
  });
