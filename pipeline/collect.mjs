// Fetch the EPBC Act threatened-species list, parse it, and emit the compact
// frontend dataset. Dependency-free (Node 20 global fetch + fs). Run by the
// quarterly data-pipeline workflow and locally.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv, buildDataset, STATUSES } from './parse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data');

// data.gov.au resource for "Threatened Species State Lists". The resource id is
// stable across amendments; the filename in the URL carries the extract date.
const CSV_URL =
  'https://data.gov.au/data/dataset/ae652011-f39e-4c6c-91b8-1dc2d2dfee8f/resource/78401dce-1f40-49d3-92c4-3713d6e34974/download/20260206spcs.csv';

// data.gov.au 403s bare clients; a browser UA + Accept is enough.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/csv,application/octet-stream,*/*',
};

async function main() {
  process.stdout.write(`Fetching ${CSV_URL}\n`);
  const res = await fetch(CSV_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`CSV fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  process.stdout.write(`Downloaded ${text.length} bytes\n`);

  const rows = parseCsv(text);
  process.stdout.write(`Parsed ${rows.length} rows\n`);

  const { meta, species } = buildDataset(rows, { generated: new Date().toISOString() });

  // ── Drift asserts: fail the build if the numbers stop reconciling ──
  const statusSum = STATUSES.reduce((a, s) => a + (meta.byStatus[s.code] || 0), 0);
  if (statusSum !== meta.total) {
    throw new Error(`Status sum ${statusSum} !== total ${meta.total}`);
  }
  const kingdomSum = Object.values(meta.byKingdom).reduce((a, b) => a + b, 0);
  if (kingdomSum !== meta.total) {
    throw new Error(`Kingdom sum ${kingdomSum} !== total ${meta.total}`);
  }
  if (meta.total < 1500) {
    throw new Error(`Suspiciously few species parsed: ${meta.total}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'species.json'), JSON.stringify({ meta, species }));
  process.stdout.write(
    `Wrote species.json — ${meta.total} species, ${meta.families} families, ` +
      `${meta.genera} genera. Status: ${STATUSES.map((s) => `${s.code} ${meta.byStatus[s.code]}`).join(', ')}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`FATAL: ${e.stack || e}\n`);
  process.exit(1);
});
