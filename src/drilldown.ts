// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Ctx } from './app';
import { STATUS, fmt, esc, statusPill, groupBy, jurisName, Species } from './data';

let overlay: HTMLDivElement | null = null;

export function closeDrawer(): void {
  if (overlay) {
    overlay.classList.remove('open');
    const el = overlay;
    // fully detach after the transition so a closed drawer is never a live
    // off-canvas box (iOS Safari treats translateX(100%) as real width).
    window.setTimeout(() => { if (el.parentElement) el.remove(); }, 260);
    overlay = null;
    if (location.hash.startsWith('#s=') || location.hash.startsWith('#state=')) {
      history.replaceState(null, '', location.pathname + location.search + '#v=explorer');
    }
  }
}

function mount(inner: string): HTMLElement {
  closeDrawerImmediate();
  overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.innerHTML = `<div class="drawer" role="dialog" aria-modal="true">
    <button class="drawer-close" type="button" aria-label="Close">×</button>
    <div class="drawer-body">${inner}</div>
  </div>`;
  document.body.appendChild(overlay);
  // force reflow then animate in
  void overlay.offsetWidth;
  overlay.classList.add('open');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDrawer(); });
  overlay.querySelector('.drawer-close')!.addEventListener('click', closeDrawer);
  return overlay.querySelector('.drawer-body') as HTMLElement;
}

function closeDrawerImmediate(): void {
  if (overlay && overlay.parentElement) overlay.remove();
  overlay = null;
}

export function openSpeciesDrawer(ctx: Ctx, id: string): void {
  const sp = ctx.data.species.find((s) => s.id === id);
  if (!sp) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(id)}`);
  const st = STATUS[sp.status];
  const chain = [
    { k: 'Kingdom', v: sp.kingdom },
    { k: 'Class', v: sp.cls },
    { k: 'Family', v: sp.family },
    { k: 'Genus', v: sp.genus },
  ];
  const jur = sp.juris.length
    ? sp.juris.map((c) => `<button class="jchip lg${sp.juris.length === 1 ? ' only' : ''}" data-juris="${c}" type="button">${esc(jurisName(ctx.data, c))}</button>`).join('')
    : '<span class="muted">No jurisdiction recorded on the list.</span>';

  const body = mount(`
    <div class="dd-kingdom" style="color:${sp.kingdom === 'Plantae' ? '#2f8f5b' : '#b06a2c'}">${esc(sp.kingdom)}</div>
    <h2 class="dd-title">${sp.common ? esc(sp.common) : `<i>${esc(sp.sci)}</i>`}</h2>
    ${sp.common ? `<p class="dd-sci"><i>${esc(sp.sci)}</i></p>` : ''}
    ${sp.cur ? `<p class="dd-cur">Now treated as <i>${esc(sp.cur)}</i></p>` : ''}
    <div class="dd-status">${statusPill(sp.status)}<div><strong>${esc(st.label)}</strong><span>${esc(st.blurb)}</span></div></div>

    <h3 class="dd-h">Classification</h3>
    <div class="dd-taxo">${chain.map((c) => `<button class="taxo-step" data-taxo="${c.k}" data-val="${esc(c.v)}" type="button"><span>${c.k}</span><em>${esc(c.v)}</em></button>`).join('<span class="taxo-arrow">→</span>')}</div>

    <h3 class="dd-h">${sp.juris.length === 1 ? 'Found only in' : 'Where it occurs'}</h3>
    <div class="dd-juris">${jur}</div>
    ${sp.juris.length === 1 ? '<p class="dd-note">Endemic — recorded from this one place only.</p>' : ''}

    ${sp.profile ? `<a class="dd-link" href="${esc(sp.profile)}" target="_blank" rel="noopener">Full profile on the government SPRAT database ↗</a>` : ''}
  `);

  body.querySelectorAll<HTMLElement>('.jchip[data-juris]').forEach((el) =>
    el.addEventListener('click', () => { closeDrawer(); ctx.openExplorer({ juris: el.getAttribute('data-juris') ?? undefined }); }),
  );
  body.querySelectorAll<HTMLElement>('.taxo-step').forEach((el) =>
    el.addEventListener('click', () => {
      const k = el.getAttribute('data-taxo');
      const v = el.getAttribute('data-val') ?? undefined;
      closeDrawer();
      if (k === 'Kingdom') ctx.openExplorer({ kingdom: v });
      else if (k === 'Class') ctx.openExplorer({ cls: v });
      else if (k === 'Family') ctx.openExplorer({ family: v });
      else ctx.openExplorer({ genus: v });
    }),
  );
}

export function openStateDrawer(ctx: Ctx, code: string): void {
  const j = ctx.data.meta.jurisdictions.find((x) => x.code === code);
  if (!j) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#state=${encodeURIComponent(code)}`);
  const here = ctx.data.species.filter((s) => s.juris.includes(code));
  const cr = here.filter((s) => s.status === 'CR').length;
  const ex = here.filter((s) => s.status === 'EX' || s.status === 'EW').length;
  const topFam = groupBy(here, (s) => s.family).slice(0, 8);
  const topCls = groupBy(here, (s) => s.cls).slice(0, 6);
  const bar = (rows: { key: string; total: number }[], kind: string) => {
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows
      .map(
        (r) => `<button class="mini-bar" type="button" data-${kind}="${esc(r.key)}" data-tip="${esc(r.key)}: ${fmt(r.total)} listed in ${esc(j.name)}">
        <span class="mb-label">${esc(r.key)}</span><span class="mb-track"><span style="width:${(r.total / max) * 100}%"></span></span><span class="mb-val">${fmt(r.total)}</span></button>`,
      )
      .join('');
  };

  const body = mount(`
    <div class="dd-kingdom">${j.type === 'state' ? 'State / territory' : j.type === 'marine' ? 'Marine area' : 'External territory'}</div>
    <h2 class="dd-title">${esc(j.name)}</h2>
    <div class="dd-stats">
      <div><span class="ds-num">${fmt(j.count)}</span><span class="ds-lab">listed species</span></div>
      <div><span class="ds-num">${fmt(cr)}</span><span class="ds-lab">critically endangered</span></div>
      <div><span class="ds-num">${fmt(j.endemic)}</span><span class="ds-lab">found only here</span></div>
      <div><span class="ds-num">${fmt(ex)}</span><span class="ds-lab">extinct / in wild</span></div>
    </div>

    <h3 class="dd-h">Most-affected families</h3>
    <div class="mini-bars">${bar(topFam, 'family')}</div>
    <h3 class="dd-h">Most-affected groups</h3>
    <div class="mini-bars">${bar(topCls, 'cls')}</div>

    <button class="dd-link btn-solid" id="dd-open-all" type="button">Open all ${fmt(j.count)} species in the Explorer →</button>
  `);

  body.querySelector('#dd-open-all')!.addEventListener('click', () => { closeDrawer(); ctx.openExplorer({ juris: code }); });
  body.querySelectorAll<HTMLElement>('.mini-bar[data-family]').forEach((el) =>
    el.addEventListener('click', () => { closeDrawer(); ctx.openExplorer({ juris: code, family: el.getAttribute('data-family') ?? undefined }); }),
  );
  body.querySelectorAll<HTMLElement>('.mini-bar[data-cls]').forEach((el) =>
    el.addEventListener('click', () => { closeDrawer(); ctx.openExplorer({ juris: code, cls: el.getAttribute('data-cls') ?? undefined }); }),
  );
}

export function initDrawerKeys(): void {
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
}

export type { Species };
