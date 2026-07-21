import { Dataset, STATUS, fmt, pct, groupBy, Species } from './data';
import type { Filter } from './app';

export interface Insight {
  severity: 'info' | 'warning' | 'alert';
  title: string;
  body: string;
  action?: { label: string; filter: Filter };
}

/** Pure, deterministic anomaly/insight detection over the dataset. */
export function computeInsights(data: Dataset): Insight[] {
  const { species, meta } = data;
  const out: Insight[] = [];
  const total = meta.total;

  // 1. Plants dominate
  const plants = meta.byKingdom['Plantae'] ?? 0;
  const animals = meta.byKingdom['Animalia'] ?? 0;
  out.push({
    severity: 'info',
    title: 'Plants, not animals, dominate the list',
    body: `${fmt(plants)} of the ${fmt(total)} listed species (${pct(plants / total, 0)}) are plants — outnumbering animals (${fmt(animals)}) by more than two to one. Public attention skews to animals, but the plant crisis is larger.`,
    action: { label: 'See the plants', filter: { kingdom: 'Plantae' } },
  });

  // 2. Australia's mammal extinctions
  const mammalEx = species.filter((s) => s.cls === 'Mammalia' && s.status === 'EX').length;
  const totalEx = meta.byStatus.EX;
  if (mammalEx > 0) {
    out.push({
      severity: 'alert',
      title: 'Mammals lead the extinctions',
      body: `${fmt(mammalEx)} of Australia's ${fmt(totalEx)} listed extinctions are mammals — the worst modern mammal-extinction record of any country. ${fmt(meta.byStatus.EX + meta.byStatus.EW)} species in total are extinct or gone from the wild.`,
      action: { label: 'See extinct species', filter: { status: 'EX' } },
    });
  }

  // 3. Endemism headline
  const single = species.filter((s) => s.juris.length === 1).length;
  const withJuris = species.filter((s) => s.juris.length > 0).length;
  out.push({
    severity: 'warning',
    title: 'Most are found in one place only',
    body: `${pct(single / withJuris, 0)} of listed species (${fmt(single)}) occur in a single state, territory or marine area. Highly localised species have nowhere to retreat to when their one home is degraded.`,
  });

  // 4. Endemic-leader jurisdiction (state)
  const states = meta.jurisdictions.filter((j) => j.type === 'state').sort((a, b) => b.endemic - a.endemic);
  if (states[0]) {
    out.push({
      severity: 'info',
      title: `${states[0].name} holds the most irreplaceable species`,
      body: `${fmt(states[0].endemic)} listed species are found only in ${states[0].name} and nowhere else on Earth, out of ${fmt(states[0].count)} it hosts.`,
      action: { label: `Species found only in ${states[0].code}`, filter: { endemicOf: states[0].code } },
    });
  }

  // 5. External-territory concentration
  const ext = meta.jurisdictions
    .filter((j) => j.type === 'external')
    .sort((a, b) => b.endemic - a.endemic);
  if (ext[0] && ext[0].endemic > 0) {
    out.push({
      severity: 'warning',
      title: `Tiny ${ext[0].name} carries an outsized load`,
      body: `${fmt(ext[0].endemic)} species are listed only from ${ext[0].name} — a speck of land with its own irreplaceable, and highly vulnerable, wildlife.`,
      action: { label: `Species of ${ext[0].name}`, filter: { juris: ext[0].code } },
    });
  }

  // 6. Most-listed genus
  const genus = groupBy(species, (s) => s.genus)[0];
  if (genus) {
    out.push({
      severity: 'info',
      title: `${genus.key} is the single most-listed genus`,
      body: `${fmt(genus.total)} threatened species belong to the genus ${genus.key} — a hotspot of imperilment within one branch of the tree of life.`,
      action: { label: `See ${genus.key} species`, filter: { genus: genus.key } },
    });
  }

  // 7. Families that are overwhelmingly critical
  const fams = groupBy(species, (s) => s.family)
    .filter((g) => g.total >= 5)
    .map((g) => ({ key: g.key, total: g.total, crShare: (g.byStatus.CR + g.byStatus.EX + g.byStatus.EW) / g.total }))
    .filter((g) => g.crShare >= 0.55)
    .sort((a, b) => b.crShare - a.crShare || b.total - a.total);
  if (fams[0]) {
    out.push({
      severity: 'alert',
      title: `Whole families are near the brink`,
      body: `In the family ${fams[0].key}, ${pct(fams[0].crShare, 0)} of its ${fmt(fams[0].total)} listed species are critically endangered or already extinct — an entire lineage in crisis.`,
      action: { label: `See ${fams[0].key}`, filter: { family: fams[0].key } },
    });
  }

  // 8. Severity skew
  const cr = meta.byStatus.CR;
  out.push({
    severity: cr > meta.byStatus.VU ? 'alert' : 'info',
    title: 'How close to the edge',
    body: `${fmt(cr)} species (${pct(cr / total, 0)}) sit in the most severe living category, ${STATUS.CR.label}. ${fmt(meta.byStatus.VU)} are only Vulnerable — the entry point, where recovery is still most achievable.`,
    action: { label: 'See critically endangered', filter: { status: 'CR' } },
  });

  return out;
}

// exported for tests
export function _endemicOf(species: Species[], code: string): number {
  return species.filter((s) => s.juris.length === 1 && s.juris[0] === code).length;
}
