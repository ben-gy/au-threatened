// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Hand-rolled chart builders — HTML bar lists and segmented status bars.
// No chart library. Every mark carries a data-tip and a data-key for clicks.
import { STATUS, STATUS_ORDER, StatusCode, fmt, esc } from './data';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  color: string;
  sub?: string;
  tip: string;
  /** Optional per-status breakdown to paint the bar as stacked segments. */
  byStatus?: Record<StatusCode, number>;
}

/** A ranked list of horizontal bars (HTML). Rows are clickable via data-key. */
export function barList(items: BarItem[], opts: { max?: number } = {}): string {
  const max = opts.max ?? Math.max(1, ...items.map((i) => i.value));
  const rows = items
    .map((it) => {
      const w = (it.value / max) * 100;
      let fill: string;
      if (it.byStatus) {
        // stacked by status severity
        const segs = STATUS_ORDER.filter((c) => it.byStatus![c] > 0)
          .map((c) => `<span style="width:${(it.byStatus![c] / it.value) * 100}%;background:${STATUS[c].color}"></span>`)
          .join('');
        fill = `<span class="bar-fill stacked" style="width:${w}%">${segs}</span>`;
      } else {
        fill = `<span class="bar-fill" style="width:${w}%;background:${it.color}"></span>`;
      }
      return `<button class="bar-row" data-key="${esc(it.key)}" data-tip="${esc(it.tip)}" type="button">
        <span class="bar-label">${esc(it.label)}${it.sub ? `<span class="bar-sub">${esc(it.sub)}</span>` : ''}</span>
        <span class="bar-track">${fill}</span>
        <span class="bar-value">${fmt(it.value)}</span>
      </button>`;
    })
    .join('');
  return `<div class="bar-list">${rows}</div>`;
}

/** A full-width segmented bar across all conservation statuses. Clickable. */
export function statusSegmentBar(byStatus: Record<StatusCode, number>, opts: { clickable?: boolean } = {}): string {
  const total = STATUS_ORDER.reduce((a, c) => a + byStatus[c], 0) || 1;
  const segs = STATUS_ORDER.filter((c) => byStatus[c] > 0)
    .map((c) => {
      const s = STATUS[c];
      const w = (byStatus[c] / total) * 100;
      const tag = opts.clickable ? 'button' : 'span';
      const attrs = opts.clickable ? `type="button" data-key="${c}"` : '';
      return `<${tag} class="seg" ${attrs} style="width:${w}%;background:${s.color};color:${s.ink}" data-tip="${esc(s.label)}: ${fmt(byStatus[c])} species (${((byStatus[c] / total) * 100).toFixed(1)}%)">
        <span class="seg-label">${s.short} ${fmt(byStatus[c])}</span>
      </${tag}>`;
    })
    .join('');
  return `<div class="seg-bar ${opts.clickable ? 'clickable' : ''}">${segs}</div>`;
}

/** Legend chips for the status scale. */
export function statusLegend(): string {
  return `<div class="legend">${STATUS_ORDER.map((c) => {
    const s = STATUS[c];
    return `<span class="legend-item"><span class="swatch" style="background:${s.color}"></span>${esc(s.label)}</span>`;
  }).join('')}</div>`;
}

/** Simple vertical-bar histogram (SVG). Bars clickable via data-key. */
export function histogram(
  bins: { key: string; label: string; value: number; tip: string; color: string }[],
  opts: { width?: number; height?: number } = {},
): string {
  const W = opts.width ?? 720;
  const H = opts.height ?? 240;
  const padL = 40, padB = 34, padT = 12, padR = 12;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...bins.map((b) => b.value));
  const bw = plotW / bins.length;
  const bars = bins
    .map((b, i) => {
      const h = (b.value / max) * plotH;
      const x = padL + i * bw + bw * 0.12;
      const y = padT + (plotH - h);
      const w = bw * 0.76;
      return `<g class="hbar" data-key="${esc(b.key)}">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${b.color}" data-tip="${esc(b.tip)}"></rect>
        <text x="${(x + w / 2).toFixed(1)}" y="${(H - padB + 15).toFixed(1)}" text-anchor="middle" class="hist-x">${esc(b.label)}</text>
        <text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="hist-v">${b.value > 0 ? fmt(b.value) : ''}</text>
      </g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="hist-svg" role="img" aria-label="Distribution histogram" preserveAspectRatio="xMidYMid meet">
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="axis"></line>
    ${bars}
  </svg>`;
}
