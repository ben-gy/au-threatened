// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Ctx, View, Filter } from '../app';
import { STATUS, STATUS_ORDER, Species, fmt, esc, statusPill, jurisName, groupBy } from '../data';

type SortKey = 'status' | 'common' | 'sci' | 'family' | 'span';

const CAP = 400;

export const renderExplorer: View = (root: HTMLElement, ctx: Ctx) => {
  const { species } = ctx.data;
  const filter: Filter = { ...ctx.getFilter() };
  let sort: SortKey = 'status';
  let searchTimer = 0;

  const classes = groupBy(species, (s) => s.cls).map((g) => g.key);

  root.innerHTML = `
    <section class="view-intro">
      <h2>Explore every listed species</h2>
      <p>Search and filter all ${fmt(species.length)} threatened plants and animals. Click any row for its full profile.</p>
    </section>
    <div class="toolbar explorer-toolbar">
      <input id="ex-search" class="search" type="search" placeholder="Search common or scientific name, family, genus…" autocomplete="off" aria-label="Search species" />
      <select id="ex-status" class="select" aria-label="Filter by status">
        <option value="">All statuses</option>
        ${STATUS_ORDER.map((c) => `<option value="${c}">${esc(STATUS[c].label)}</option>`).join('')}
      </select>
      <select id="ex-kingdom" class="select" aria-label="Filter by kingdom">
        <option value="">Plants &amp; animals</option>
        <option value="Plantae">Plants only</option>
        <option value="Animalia">Animals only</option>
      </select>
      <select id="ex-class" class="select" aria-label="Filter by class">
        <option value="">All classes</option>
        ${classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <button id="ex-clear" class="btn-ghost" type="button">Clear</button>
    </div>
    <div id="ex-chips" class="chips"></div>
    <div id="ex-count" class="result-count"></div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th data-sort="common" class="sortable">Common name</th>
          <th data-sort="sci" class="sortable">Scientific name</th>
          <th data-sort="status" class="sortable">Status</th>
          <th class="col-group">Group</th>
          <th data-sort="family" class="sortable">Family</th>
          <th data-sort="span" class="sortable">Where it lives</th>
        </tr></thead>
        <tbody id="ex-body"></tbody>
      </table>
    </div>
  `;

  const searchEl = root.querySelector('#ex-search') as HTMLInputElement;
  const statusEl = root.querySelector('#ex-status') as HTMLSelectElement;
  const kingdomEl = root.querySelector('#ex-kingdom') as HTMLSelectElement;
  const classEl = root.querySelector('#ex-class') as HTMLSelectElement;
  const chipsEl = root.querySelector('#ex-chips') as HTMLElement;
  const countEl = root.querySelector('#ex-count') as HTMLElement;
  const bodyEl = root.querySelector('#ex-body') as HTMLElement;

  // hydrate controls from incoming filter
  if (filter.q) searchEl.value = filter.q;
  if (filter.status) statusEl.value = filter.status;
  if (filter.kingdom) kingdomEl.value = filter.kingdom;
  if (filter.cls) classEl.value = filter.cls;

  const matches = (): Species[] => {
    const q = (filter.q ?? '').trim().toLowerCase();
    return species.filter((s) => {
      if (filter.status && s.status !== filter.status) return false;
      if (filter.kingdom && s.kingdom !== filter.kingdom) return false;
      if (filter.cls && s.cls !== filter.cls) return false;
      if (filter.family && s.family !== filter.family) return false;
      if (filter.genus && s.genus !== filter.genus) return false;
      if (filter.juris && !s.juris.includes(filter.juris)) return false;
      if (filter.endemicOf && !(s.juris.length === 1 && s.juris[0] === filter.endemicOf)) return false;
      if (q) {
        const hay = `${s.common} ${s.sci} ${s.cur} ${s.family} ${s.genus} ${s.cls}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const sorted = (list: Species[]): Species[] => {
    const arr = [...list];
    const sev = (s: Species) => STATUS_ORDER.indexOf(s.status);
    const cmp: Record<SortKey, (a: Species, b: Species) => number> = {
      status: (a, b) => sev(a) - sev(b) || (a.common || a.sci).localeCompare(b.common || b.sci),
      common: (a, b) => (a.common || '~').localeCompare(b.common || '~'),
      sci: (a, b) => a.sci.localeCompare(b.sci),
      family: (a, b) => a.family.localeCompare(b.family) || a.sci.localeCompare(b.sci),
      span: (a, b) => b.juris.length - a.juris.length || sev(a) - sev(b),
    };
    arr.sort(cmp[sort]);
    return arr;
  };

  const chipDefs = (): { key: keyof Filter; label: string }[] => {
    const out: { key: keyof Filter; label: string }[] = [];
    if (filter.family) out.push({ key: 'family', label: `Family: ${filter.family}` });
    if (filter.genus) out.push({ key: 'genus', label: `Genus: ${filter.genus}` });
    if (filter.juris) out.push({ key: 'juris', label: `In: ${jurisName(ctx.data, filter.juris)}` });
    if (filter.endemicOf) out.push({ key: 'endemicOf', label: `Found only in: ${jurisName(ctx.data, filter.endemicOf)}` });
    return out;
  };

  const draw = () => {
    const found = sorted(matches());
    chipsEl.innerHTML = chipDefs()
      .map((c) => `<button class="chip" type="button" data-chip="${c.key}">${esc(c.label)} <span aria-hidden="true">×</span></button>`)
      .join('');
    chipsEl.querySelectorAll<HTMLElement>('.chip').forEach((el) =>
      el.addEventListener('click', () => {
        (filter as any)[el.getAttribute('data-chip')!] = undefined;
        draw();
      }),
    );

    countEl.textContent = found.length === species.length
      ? `${fmt(found.length)} species`
      : `${fmt(found.length)} of ${fmt(species.length)} species`;

    const shown = found.slice(0, CAP);
    bodyEl.innerHTML = shown
      .map((s) => {
        const where = s.juris.length
          ? s.juris.map((c) => `<span class="jchip${s.juris.length === 1 ? ' only' : ''}">${c}</span>`).join('')
          : '<span class="jchip none">—</span>';
        return `<tr data-id="${esc(s.id)}" tabindex="0">
          <td class="c-common">${s.common ? esc(s.common) : '<em class="muted">—</em>'}</td>
          <td class="c-sci"><i>${esc(s.sci)}</i></td>
          <td>${statusPill(s.status)}</td>
          <td class="c-group"><span class="k-dot" style="background:${s.kingdom === 'Plantae' ? '#2f8f5b' : '#b06a2c'}"></span>${esc(s.cls)}</td>
          <td class="c-family">${esc(s.family)}</td>
          <td class="c-where">${where}</td>
        </tr>`;
      })
      .join('');
    if (found.length > CAP) {
      bodyEl.insertAdjacentHTML(
        'beforeend',
        `<tr class="more-row"><td colspan="6">Showing the first ${fmt(CAP)}. Narrow your search to see the rest.</td></tr>`,
      );
    }
    if (found.length === 0) {
      bodyEl.innerHTML = `<tr class="empty-row"><td colspan="6">No species match these filters. <button type="button" id="ex-reset" class="link">Reset</button></td></tr>`;
      bodyEl.querySelector('#ex-reset')?.addEventListener('click', clearAll);
    }

    bodyEl.querySelectorAll<HTMLElement>('tr[data-id]').forEach((tr) => {
      const open = () => ctx.openSpecies(tr.getAttribute('data-id') ?? '');
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') open(); });
    });
    root.querySelectorAll<HTMLElement>('th.sortable').forEach((th) =>
      th.classList.toggle('active', th.getAttribute('data-sort') === sort),
    );
  };

  const clearAll = () => {
    for (const k of Object.keys(filter) as (keyof Filter)[]) (filter as any)[k] = undefined;
    searchEl.value = '';
    statusEl.value = '';
    kingdomEl.value = '';
    classEl.value = '';
    draw();
  };

  searchEl.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filter.q = searchEl.value; draw(); }, 300);
  });
  statusEl.addEventListener('change', () => { filter.status = (statusEl.value || undefined) as any; draw(); });
  kingdomEl.addEventListener('change', () => { filter.kingdom = kingdomEl.value || undefined; draw(); });
  classEl.addEventListener('change', () => { filter.cls = classEl.value || undefined; draw(); });
  root.querySelector('#ex-clear')!.addEventListener('click', clearAll);
  root.querySelectorAll<HTMLElement>('th.sortable').forEach((th) =>
    th.addEventListener('click', () => { sort = th.getAttribute('data-sort') as SortKey; draw(); }),
  );

  draw();
};
