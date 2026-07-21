import { describe, expect, it } from 'vitest';
import { computeInsights, _endemicOf } from '../src/analysis';
import { Dataset, Species } from '../src/data';

const sp = (o: Partial<Species>): Species => ({
  id: o.id ?? String(Math.round(o.juris?.length ?? 0)), sci: o.sci ?? 's', cur: '', common: '',
  status: o.status ?? 'VU', kingdom: o.kingdom ?? 'Plantae', cls: o.cls ?? 'Magnoliopsida',
  family: o.family ?? 'Fabaceae', genus: o.genus ?? 'Acacia', juris: o.juris ?? ['WA'], profile: '',
});

function makeDataset(species: Species[]): Dataset {
  const codes = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA', 'NFI'];
  const byStatus = { EX: 0, EW: 0, CR: 0, EN: 0, VU: 0, CD: 0 } as Record<string, number>;
  const byKingdom: Record<string, number> = {};
  for (const s of species) { byStatus[s.status]++; byKingdom[s.kingdom] = (byKingdom[s.kingdom] || 0) + 1; }
  const jurisdictions = codes.map((code) => ({
    code, name: code, type: (code === 'NFI' ? 'external' : 'state') as any,
    count: species.filter((s) => s.juris.includes(code)).length,
    endemic: species.filter((s) => s.juris.length === 1 && s.juris[0] === code).length,
  }));
  return {
    meta: {
      total: species.length, extracted: '2026-Feb-06', generated: '', source: { name: '', url: '', publisher: '' },
      byStatus: byStatus as any, byKingdom, jurisdictions,
      families: new Set(species.map((s) => s.family)).size, genera: new Set(species.map((s) => s.genus)).size,
    },
    species,
  };
}

const species: Species[] = [
  sp({ id: 'a', status: 'CR', kingdom: 'Plantae', cls: 'Magnoliopsida', family: 'Fabaceae', genus: 'Acacia', juris: ['WA'] }),
  sp({ id: 'b', status: 'VU', kingdom: 'Plantae', cls: 'Liliopsida', family: 'Fabaceae', genus: 'Acacia', juris: ['WA', 'SA'] }),
  sp({ id: 'c', status: 'EX', kingdom: 'Animalia', cls: 'Mammalia', family: 'Muridae', genus: 'Rattus', juris: ['NSW'] }),
  sp({ id: 'd', status: 'EN', kingdom: 'Plantae', cls: 'Magnoliopsida', family: 'Fabaceae', genus: 'Acacia', juris: ['NFI'] }),
];

describe('computeInsights', () => {
  const insights = computeInsights(makeDataset(species));
  it('always returns cards', () => {
    expect(insights.length).toBeGreaterThanOrEqual(5);
    for (const i of insights) {
      expect(i.title).toBeTruthy();
      expect(i.body).toBeTruthy();
      expect(['info', 'warning', 'alert']).toContain(i.severity);
    }
  });
  it('is deterministic', () => {
    const again = computeInsights(makeDataset(species));
    expect(again.map((i) => i.title)).toEqual(insights.map((i) => i.title));
  });
  it('detects the mammal extinction when present', () => {
    expect(insights.some((i) => /mammal/i.test(i.title))).toBe(true);
  });
  it('flags the most-listed genus', () => {
    expect(insights.some((i) => i.body.includes('Acacia'))).toBe(true);
  });
});

describe('_endemicOf', () => {
  it('counts single-jurisdiction species for a code', () => {
    expect(_endemicOf(species, 'WA')).toBe(1);
    expect(_endemicOf(species, 'NFI')).toBe(1);
    expect(_endemicOf(species, 'SA')).toBe(0);
  });
});
