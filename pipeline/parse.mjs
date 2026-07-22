// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Pure, dependency-free parsing + aggregation for the EPBC threatened-species
// list. Imported by BOTH pipeline/collect.mjs and the vitest suite, so it must
// use zero Node built-ins at module scope (the CI-traps rule).

// ── Jurisdiction metadata ──────────────────────────────────────────────────
// The CSV has one flag column per jurisdiction. The 8 mainland states/
// territories join to patterns/geo/au-states.geojson by `code`; the external
// territories and the Commonwealth Marine Area have no state polygon and are
// surfaced separately in the UI.
export const JURISDICTIONS = [
  { code: 'ACT', name: 'Australian Capital Territory', type: 'state' },
  { code: 'NSW', name: 'New South Wales', type: 'state' },
  { code: 'NT', name: 'Northern Territory', type: 'state' },
  { code: 'QLD', name: 'Queensland', type: 'state' },
  { code: 'SA', name: 'South Australia', type: 'state' },
  { code: 'TAS', name: 'Tasmania', type: 'state' },
  { code: 'VIC', name: 'Victoria', type: 'state' },
  { code: 'WA', name: 'Western Australia', type: 'state' },
  { code: 'ACI', name: 'Ashmore & Cartier Islands', type: 'external' },
  { code: 'CKI', name: 'Cocos (Keeling) Islands', type: 'external' },
  { code: 'CI', name: 'Christmas Island', type: 'external' },
  { code: 'CSI', name: 'Coral Sea Islands', type: 'external' },
  { code: 'JBT', name: 'Jervis Bay Territory', type: 'external' },
  { code: 'NFI', name: 'Norfolk Island', type: 'external' },
  { code: 'HMI', name: 'Heard & McDonald Islands', type: 'external' },
  { code: 'AAT', name: 'Australian Antarctic Territory', type: 'external' },
  { code: 'CMA', name: 'Commonwealth Marine Area', type: 'marine' },
];

// ── Conservation status, most→least severe ─────────────────────────────────
export const STATUSES = [
  { code: 'EX', label: 'Extinct', raw: 'Extinct' },
  { code: 'EW', label: 'Extinct in the Wild', raw: 'Extinct in the wild' },
  { code: 'CR', label: 'Critically Endangered', raw: 'Critically Endangered' },
  { code: 'EN', label: 'Endangered', raw: 'Endangered' },
  { code: 'VU', label: 'Vulnerable', raw: 'Vulnerable' },
  { code: 'CD', label: 'Conservation Dependent', raw: 'Conservation Dependent' },
];

const STATUS_BY_RAW = new Map(STATUSES.map((s) => [s.raw.toLowerCase(), s.code]));

/** Minimal RFC-4180 CSV reader: handles quoted fields, embedded commas,
 *  doubled quotes, and CRLF/LF line endings. Returns array of string[] rows. */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // swallow — handled by the following \n (or EOF below)
    } else {
      field += c;
    }
  }
  // flush trailing field/row (files without a final newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Parse the CSV text into an array of row objects keyed by header name. */
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = (cells[c] ?? '').trim();
    out.push(obj);
  }
  return out;
}

const clean = (v) => {
  const s = (v ?? '').trim();
  return s === '' || s === '-' ? '' : s;
};

/** Build the compact frontend dataset from parsed CSV row objects. */
export function buildDataset(rows, opts = {}) {
  const species = [];
  const seen = new Set();
  for (const row of rows) {
    const statusRaw = clean(row['Threatened status']);
    const statusCode = STATUS_BY_RAW.get(statusRaw.toLowerCase());
    if (!statusCode) continue; // skip any row without a recognised status

    const sci = clean(row['Scientific Name']);
    if (!sci) continue;
    const cur = clean(row['Current Scientific Name']);
    const listedId = clean(row['Listed SPRAT TaxonID']);
    const id = listedId || `x${species.length}`;
    if (seen.has(id)) continue;
    seen.add(id);

    let cls = clean(row['Class']) || 'Unknown';
    cls = cls.replace(/\s*\(no class\)\s*$/i, '').trim() || 'Unknown';

    const juris = JURISDICTIONS.map((j) => j.code).filter((code) => row[code] === 'Yes');

    species.push({
      id,
      sci,
      cur: cur && cur !== sci ? cur : '',
      common: clean(row['Common Name']),
      status: statusCode,
      kingdom: clean(row['Kingdom']) || 'Unknown',
      cls,
      family: clean(row['Family']) || 'Unknown',
      genus: clean(row['Genus']) || 'Unknown',
      juris,
      profile: clean(row['Profile']),
    });
  }

  // ── Aggregates (also the drift asserts) ──
  const byStatus = {};
  for (const s of STATUSES) byStatus[s.code] = 0;
  const byKingdom = {};
  for (const sp of species) {
    byStatus[sp.status]++;
    byKingdom[sp.kingdom] = (byKingdom[sp.kingdom] || 0) + 1;
  }

  const jurisdictions = JURISDICTIONS.map((j) => {
    let count = 0;
    let endemic = 0;
    for (const sp of species) {
      if (sp.juris.includes(j.code)) {
        count++;
        if (sp.juris.length === 1) endemic++;
      }
    }
    return { code: j.code, name: j.name, type: j.type, count, endemic };
  });

  const meta = {
    total: species.length,
    extracted: clean((rows[0] || {})['Date extracted']) || '',
    generated: opts.generated || '',
    source: {
      name: 'EPBC Act Threatened Species State Lists',
      url: 'https://data.gov.au/data/dataset/threatened-species-state-lists',
      publisher: 'Dept of Climate Change, Energy, the Environment and Water (SPRAT)',
    },
    byStatus,
    byKingdom,
    jurisdictions,
    families: new Set(species.map((s) => s.family)).size,
    genera: new Set(species.map((s) => s.genus)).size,
  };

  return { meta, species };
}
