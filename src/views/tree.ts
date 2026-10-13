// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Ctx, View } from '../app';
import { fmt, esc, kingdomColor, groupBy } from '../data';
import { squarify } from '../utils/squarify';
import { attachSvgZoom, SvgZoomHandle } from '../utils/svgZoom';

// mix a hex colour toward white by t in [0,1]
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}

interface Level {
  title: string;
  crumb: { label: string; depth: number }[];
  items: { key: string; label: string; value: number; kingdom: string }[];
  depth: number; // 0 kingdom, 1 class, 2 family
  kingdom?: string;
  cls?: string;
}

export const renderTree: View = (root: HTMLElement, ctx: Ctx) => {
  const { species } = ctx.data;
  let zoom: SvgZoomHandle | null = null;

  // navigation state
  let kingdom: string | null = null;
  let cls: string | null = null;

  root.innerHTML = `
    <section class="view-intro">
      <h2>The tree of life, by imperilment</h2>
      <p>Every listed species placed in its branch of life — ${'Kingdom → Class → Family'}. Tile size is the number of threatened species. Click a tile to zoom in; click a family to open its species. Colour marks the kingdom (green plants, amber animals).</p>
    </section>
    <nav class="crumbs" id="tree-crumbs"></nav>
    <section class="panel treemap-panel">
      <div id="treemap-wrap" class="treemap-wrap"></div>
    </section>
  `;
  const crumbEl = root.querySelector('#tree-crumbs') as HTMLElement;
  const wrap = root.querySelector('#treemap-wrap') as HTMLElement;

  const computeLevel = (): Level => {
    if (!kingdom) {
      const g = groupBy(species, (s) => s.kingdom);
      return {
        title: 'Kingdoms',
        crumb: [{ label: 'All life', depth: 0 }],
        depth: 0,
        items: g.map((x) => ({ key: x.key, label: x.key, value: x.total, kingdom: x.key })),
      };
    }
    if (kingdom && !cls) {
      const sub = species.filter((s) => s.kingdom === kingdom);
      const g = groupBy(sub, (s) => s.cls);
      return {
        title: `${kingdom} — classes`,
        crumb: [{ label: 'All life', depth: 0 }, { label: kingdom, depth: 1 }],
        depth: 1,
        kingdom,
        items: g.map((x) => ({ key: x.key, label: x.key, value: x.total, kingdom: kingdom! })),
      };
    }
    const sub = species.filter((s) => s.kingdom === kingdom && s.cls === cls);
    const g = groupBy(sub, (s) => s.family);
    return {
      title: `${cls} — families`,
      crumb: [{ label: 'All life', depth: 0 }, { label: kingdom!, depth: 1 }, { label: cls!, depth: 2 }],
      depth: 2,
      kingdom: kingdom!,
      cls: cls!,
      items: g.map((x) => ({ key: x.key, label: x.key, value: x.total, kingdom: kingdom! })),
    };
  };

  const drill = (level: Level, key: string) => {
    if (level.depth === 0) kingdom = key;
    else if (level.depth === 1) cls = key;
    else ctx.openExplorer({ kingdom: level.kingdom, cls: level.cls, family: key });
    if (level.depth < 2) render();
  };

  const gotoDepth = (depth: number) => {
    if (depth === 0) { kingdom = null; cls = null; }
    else if (depth === 1) { cls = null; }
    render();
  };

  const render = () => {
    if (zoom) { zoom.destroy(); zoom = null; }
    const level = computeLevel();

    crumbEl.innerHTML = level.crumb
      .map((c, i) =>
        i < level.crumb.length - 1
          ? `<button type="button" class="crumb" data-depth="${c.depth}">${esc(c.label)}</button><span class="crumb-sep">›</span>`
          : `<span class="crumb current">${esc(c.label)}</span>`,
      )
      .join('');
    crumbEl.querySelectorAll<HTMLElement>('.crumb[data-depth]').forEach((b) =>
      b.addEventListener('click', () => gotoDepth(Number(b.getAttribute('data-depth')))),
    );

    const W = 1000, H = 560;
    const items = [...level.items].sort((a, b) => b.value - a.value);
    const rects = squarify(items.map((i) => i.value), W, H);
    const maxV = Math.max(1, ...items.map((i) => i.value));

    const tiles = items
      .map((it, i) => {
        const r = rects[i];
        if (r.w <= 0 || r.h <= 0) return '';
        const base = kingdomColor(it.kingdom);
        const fill = lighten(base, 0.15 + 0.5 * (1 - it.value / maxV));
        const showLabel = r.w > 54 && r.h > 26;
        const isLeaf = level.depth === 2;
        const label = showLabel
          ? `<text x="${(r.x + 6).toFixed(1)}" y="${(r.y + 17).toFixed(1)}" class="tm-label">${esc(it.label.length > Math.floor(r.w / 7) ? it.label.slice(0, Math.max(2, Math.floor(r.w / 7))) + '…' : it.label)}</text>` +
            (r.h > 42 ? `<text x="${(r.x + 6).toFixed(1)}" y="${(r.y + 33).toFixed(1)}" class="tm-value">${fmt(it.value)}</text>` : '')
          : '';
        return `<g class="tm-tile ${isLeaf ? 'leaf' : 'branch'}" data-key="${esc(it.key)}">
          <rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${fill}" stroke="#faf8f2" stroke-width="1.5" rx="2"
            data-tip="${esc(it.label)} — ${fmt(it.value)} threatened species${isLeaf ? ' · click to open' : ' · click to zoom in'}"></rect>
          ${label}
        </g>`;
      })
      .join('');

    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="treemap-svg" role="img" aria-label="${esc(level.title)} treemap" preserveAspectRatio="xMidYMid meet">${tiles}</svg>`;
    const svg = wrap.querySelector('svg') as SVGSVGElement;
    svg.querySelectorAll<SVGGElement>('.tm-tile').forEach((g) => {
      g.addEventListener('click', () => drill(level, g.getAttribute('data-key') ?? ''));
    });
    zoom = attachSvgZoom(svg, { maxScale: 12 });
  };

  render();
  return () => { if (zoom) zoom.destroy(); };
};
