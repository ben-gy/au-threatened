// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Types, data loading, shared constants, formatting, and aggregation helpers.

export type StatusCode = 'EX' | 'EW' | 'CR' | 'EN' | 'VU' | 'CD';

export interface Species {
  id: string;
  sci: string;
  cur: string;
  common: string;
  status: StatusCode;
  kingdom: string;
  cls: string;
  family: string;
  genus: string;
  juris: string[];
  profile: string;
}

export interface Jurisdiction {
  code: string;
  name: string;
  type: 'state' | 'external' | 'marine';
  count: number;
  endemic: number;
}

export interface Meta {
  total: number;
  extracted: string;
  generated: string;
  source: { name: string; url: string; publisher: string };
  byStatus: Record<StatusCode, number>;
  byKingdom: Record<string, number>;
  jurisdictions: Jurisdiction[];
  families: number;
  genera: number;
}

export interface Dataset {
  meta: Meta;
  species: Species[];
}

// ── Conservation status, most → least severe ───────────────────────────────
export interface StatusMeta {
  code: StatusCode;
  label: string;
  short: string;
  color: string;
  ink: string;
  blurb: string;
}

export const STATUS_ORDER: StatusCode[] = ['EX', 'EW', 'CR', 'EN', 'VU', 'CD'];

export const STATUS: Record<StatusCode, StatusMeta> = {
  EX: { code: 'EX', label: 'Extinct', short: 'EX', color: '#374151', ink: '#ffffff', blurb: 'No reasonable doubt the last individual has died.' },
  EW: { code: 'EW', label: 'Extinct in the Wild', short: 'EW', color: '#6d28d9', ink: '#ffffff', blurb: 'Survives only in cultivation, captivity or well outside its past range.' },
  CR: { code: 'CR', label: 'Critically Endangered', short: 'CR', color: '#b91c1c', ink: '#ffffff', blurb: 'Facing an extremely high risk of extinction in the wild.' },
  EN: { code: 'EN', label: 'Endangered', short: 'EN', color: '#ea7317', ink: '#ffffff', blurb: 'Facing a very high risk of extinction in the wild.' },
  VU: { code: 'VU', label: 'Vulnerable', short: 'VU', color: '#e0b100', ink: '#3a2f00', blurb: 'Facing a high risk of extinction in the wild.' },
  CD: { code: 'CD', label: 'Conservation Dependent', short: 'CD', color: '#84a83c', ink: '#1f2b0e', blurb: 'Not currently threatened only because a conservation programme is in place.' },
};

export const KINGDOM_COLOR: Record<string, string> = {
  Plantae: '#2f8f5b',
  Animalia: '#b06a2c',
  Fungi: '#8a6d3b',
  Unknown: '#9ca3af',
};
export function kingdomColor(k: string): string {
  return KINGDOM_COLOR[k] ?? '#9ca3af';
}

// ── Formatting ─────────────────────────────────────────────────────────────
export function fmt(n: number): string {
  return n.toLocaleString('en-AU');
}
export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}
/** Escape for use inside a data-tip / title attribute set via setAttribute. */
export function tipText(s: string): string {
  return s;
}
/** Escape for HTML text nodes / innerHTML. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function statusPill(code: StatusCode): string {
  const s = STATUS[code];
  return `<span class="pill" style="background:${s.color};color:${s.ink}" title="${esc(s.label)}">${s.short}</span>`;
}

export function jurisName(dataset: Dataset, code: string): string {
  return dataset.meta.jurisdictions.find((j) => j.code === code)?.name ?? code;
}

// ── Loading ────────────────────────────────────────────────────────────────
export async function loadDataset(): Promise<Dataset> {
  const res = await fetch('data/species.json');
  if (!res.ok) throw new Error(`Could not load data (HTTP ${res.status})`);
  const raw = (await res.json()) as Dataset;
  return raw;
}

// ── Aggregation helpers ────────────────────────────────────────────────────
export interface GroupCount {
  key: string;
  total: number;
  byStatus: Record<StatusCode, number>;
  kingdom?: string;
}

const emptyStatus = (): Record<StatusCode, number> => ({ EX: 0, EW: 0, CR: 0, EN: 0, VU: 0, CD: 0 });

/** Group species by an accessor and count totals + per-status, sorted desc. */
export function groupBy(species: Species[], accessor: (s: Species) => string): GroupCount[] {
  const map = new Map<string, GroupCount>();
  for (const sp of species) {
    const key = accessor(sp) || 'Unknown';
    let g = map.get(key);
    if (!g) {
      g = { key, total: 0, byStatus: emptyStatus(), kingdom: sp.kingdom };
      map.set(key, g);
    }
    g.total++;
    g.byStatus[sp.status]++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

/** Count species per jurisdiction code, optionally restricted to a status. */
export function jurisCounts(species: Species[], status?: StatusCode): Map<string, number> {
  const m = new Map<string, number>();
  for (const sp of species) {
    if (status && sp.status !== status) continue;
    for (const code of sp.juris) m.set(code, (m.get(code) ?? 0) + 1);
  }
  return m;
}

/** Endemic-only count per jurisdiction (species occurring in exactly one). */
export function endemicCounts(species: Species[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const sp of species) {
    if (sp.juris.length === 1) m.set(sp.juris[0], (m.get(sp.juris[0]) ?? 0) + 1);
  }
  return m;
}

/** Distribution of how many jurisdictions each species spans (1..N). */
export function spanHistogram(species: Species[]): number[] {
  const maxSpan = Math.max(1, ...species.map((s) => s.juris.length));
  const bins = new Array(maxSpan + 1).fill(0);
  for (const sp of species) bins[sp.juris.length]++;
  return bins; // index = span; bins[0] = species with no listed jurisdiction
}

export const AU_STATE_CODES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
