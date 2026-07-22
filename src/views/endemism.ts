// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Ctx, View } from '../app';
import { fmt, pct, esc, spanHistogram } from '../data';
import { histogram } from '../charts';
import { gl } from '../glossary';

export const renderEndemism: View = (root: HTMLElement, ctx: Ctx) => {
  const { species, meta } = ctx.data;
  const single = species.filter((s) => s.juris.length === 1).length;
  const noJuris = species.filter((s) => s.juris.length === 0).length;
  const withJuris = meta.total - noJuris;
  const singleShare = pct(single / withJuris, 0);

  // per-jurisdiction endemic vs shared
  const rows = meta.jurisdictions
    .map((j) => ({ ...j, shared: j.count - j.endemic }))
    .filter((j) => j.count > 0)
    .sort((a, b) => b.endemic - a.endemic || b.count - a.count);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  const bars = rows
    .map((j) => {
      const ew = (j.endemic / maxCount) * 100;
      const sw = (j.shared / maxCount) * 100;
      return `<button class="endemic-row" type="button" data-key="${j.code}" data-tip="${esc(j.name)}: ${fmt(j.endemic)} found only here, ${fmt(j.shared)} shared with other areas">
        <span class="er-name">${esc(j.name)}<span class="er-type ${j.type}">${j.type === 'state' ? j.code : j.type === 'marine' ? 'marine' : 'external'}</span></span>
        <span class="er-track">
          <span class="er-endemic" style="width:${ew}%"></span>
          <span class="er-shared" style="width:${sw}%"></span>
        </span>
        <span class="er-val"><strong>${fmt(j.endemic)}</strong> only here</span>
      </button>`;
    })
    .join('');

  // span histogram (1..N jurisdictions)
  const span = spanHistogram(species);
  const bins = [];
  for (let k = 1; k < span.length; k++) {
    if (span[k] === 0 && k > 6) continue;
    bins.push({
      key: String(k),
      label: k === 1 ? '1' : String(k),
      value: span[k],
      color: k === 1 ? '#256848' : '#9cbfa6',
      tip: `${fmt(span[k])} species occur in ${k} ${k === 1 ? 'jurisdiction only' : 'jurisdictions'}`,
    });
  }

  root.innerHTML = `
    <section class="view-intro">
      <h2>Found nowhere else</h2>
      <p>
        <strong>${singleShare}</strong> of listed species (${fmt(single)} of ${fmt(withJuris)}) are ${gl('endemic', 'endemic')} to a single
        state, territory or marine area — if they vanish there, they are gone from Earth. That makes
        some places irreplaceable in a way a simple species count can't show.
      </p>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Irreplaceable species by place</h3>
        <p>Dark green = species found <em>only</em> in that place. Light green = species it shares with elsewhere. Sorted by how many it alone would lose. Click to open the endemic species.</p>
      </div>
      <div class="endemic-legend">
        <span><span class="sw sw-endemic"></span>Endemic (found only here)</span>
        <span><span class="sw sw-shared"></span>Shared with other areas</span>
      </div>
      <div class="endemic-list">${bars}</div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>How widespread is each species?</h3>
        <p>The number of jurisdictions each listed species occurs in. The tall first bar — species in just one place — is the story: most threatened Australian wildlife is highly localised.</p>
      </div>
      <div class="chart-scroll">${histogram(bins, { width: 720, height: 240 })}</div>
    </section>
  `;

  root.querySelectorAll<HTMLElement>('.endemic-row').forEach((el) =>
    el.addEventListener('click', () => ctx.openExplorer({ endemicOf: el.getAttribute('data-key') ?? undefined })),
  );
};
