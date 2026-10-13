// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Ctx, View } from '../app';
import { fmt, esc, groupBy, jurisName } from '../data';

export const renderMatrix: View = (root: HTMLElement, ctx: Ctx) => {
  const { species, meta } = ctx.data;
  const cols = meta.jurisdictions.filter((j) => j.count > 0);
  const classes = groupBy(species, (s) => s.cls).filter((g) => g.total >= 2);

  // cell[cls][jurisCode] = count
  const cell = new Map<string, Map<string, number>>();
  let maxCell = 1;
  for (const g of classes) cell.set(g.key, new Map());
  for (const sp of species) {
    const m = cell.get(sp.cls);
    if (!m) continue;
    for (const code of sp.juris) {
      const v = (m.get(code) ?? 0) + 1;
      m.set(code, v);
      if (v > maxCell) maxCell = v;
    }
  }

  const intensity = (v: number) => {
    if (v <= 0) return 0;
    return 0.12 + 0.88 * Math.sqrt(v / maxCell); // sqrt for skew
  };
  const cellColor = (v: number) => (v <= 0 ? 'transparent' : `rgba(37,104,72,${intensity(v).toFixed(3)})`);

  const headCells = cols
    .map((c) => `<th class="mx-col" data-tip="${esc(c.name)} — ${fmt(c.count)} listed species"><span>${c.code}</span></th>`)
    .join('');

  const bodyRows = classes
    .map((g) => {
      const m = cell.get(g.key)!;
      const cells = cols
        .map((c) => {
          const v = m.get(c.code) ?? 0;
          const dark = intensity(v) > 0.62;
          return `<td class="mx-cell ${v > 0 ? 'has' : ''}" ${v > 0 ? `data-cls="${esc(g.key)}" data-juris="${c.code}"` : ''}
            style="background:${cellColor(v)};color:${dark ? '#fff' : '#1f3a2b'}"
            ${v > 0 ? `data-tip="${esc(g.key)} in ${esc(jurisName(ctx.data, c.code))}: ${fmt(v)} threatened species"` : ''}>${v > 0 ? fmt(v) : ''}</td>`;
        })
        .join('');
      return `<tr>
        <th class="mx-row" data-tip="${esc(g.key)}: ${fmt(g.total)} listed species" data-cls="${esc(g.key)}"><span>${esc(g.key)}</span><em>${fmt(g.total)}</em></th>
        ${cells}
      </tr>`;
    })
    .join('');

  root.innerHTML = `
    <section class="view-intro">
      <h2>Which groups are threatened where</h2>
      <p>A cross-reference of every ${'class'} of life against every jurisdiction. Darker cells hold more threatened species. It reveals the geography of each group — birds spread wide, many plant classes concentrate in one or two states. Click a cell to open those species; click a row label for the whole class.</p>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Class × jurisdiction</h3><p>Columns are states, territories and the marine area (hover a header for its full name). Cell value = species of that class recorded there.</p></div>
      <div class="matrix-scroll">
        <table class="matrix">
          <thead><tr><th class="mx-corner">Class</th>${headCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </section>
  `;

  root.querySelectorAll<HTMLElement>('.mx-cell.has').forEach((td) =>
    td.addEventListener('click', () => ctx.openExplorer({ cls: td.getAttribute('data-cls') ?? undefined, juris: td.getAttribute('data-juris') ?? undefined })),
  );
  root.querySelectorAll<HTMLElement>('.mx-row').forEach((th) =>
    th.addEventListener('click', () => ctx.openExplorer({ cls: th.getAttribute('data-cls') ?? undefined })),
  );
};
