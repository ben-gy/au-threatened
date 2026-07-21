import { describe, expect, it } from 'vitest';
import { parseCsvRows, parseCsv, buildDataset, JURISDICTIONS, STATUSES } from '../pipeline/parse.mjs';

const HEADER =
  'Scientific Name,Common Name,Current Scientific Name,Threatened status,ACT,NSW,NT,QLD,SA,TAS,VIC,WA,ACI,CKI,CI,CSI,JBT,NFI,HMI,AAT,CMA,Listed SPRAT TaxonID,Current SPRAT TaxonID,Kingdom,Class,Profile,Date extracted,NSL Name,Family,Genus,Species,Infraspecific Rank,Infraspecies,Species Author,Infraspecies Author';

function row(cells: Record<string, string>): string {
  const cols = HEADER.split(',');
  return cols
    .map((c) => {
      const v = cells[c] ?? '-';
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(',');
}

describe('parseCsvRows', () => {
  it('splits simple rows', () => {
    expect(parseCsvRows('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsvRows('name,x\n"Grass Wattle, Chittering",Yes');
    expect(rows[1]).toEqual(['Grass Wattle, Chittering', 'Yes']);
  });
  it('handles doubled quotes', () => {
    const rows = parseCsvRows('q\n"she said ""hi"""');
    expect(rows[1][0]).toBe('she said "hi"');
  });
  it('handles CRLF line endings and BOM', () => {
    const rows = parseCsvRows('﻿a,b\r\n1,2\r\n');
    expect(rows[0]).toEqual(['a', 'b']);
    expect(rows[1]).toEqual(['1', '2']);
  });
  it('keeps a final row without trailing newline', () => {
    expect(parseCsvRows('a\n1').length).toBe(2);
  });
});

describe('parseCsv → objects', () => {
  it('keys cells by header', () => {
    const objs = parseCsv(`${HEADER}\n${row({ 'Scientific Name': 'Acacia anomala', 'Threatened status': 'Vulnerable', WA: 'Yes' })}`);
    expect(objs).toHaveLength(1);
    expect(objs[0]['Scientific Name']).toBe('Acacia anomala');
    expect(objs[0]['WA']).toBe('Yes');
  });
});

describe('buildDataset', () => {
  const csv = [
    HEADER,
    row({ 'Scientific Name': 'Abutilon julianae', 'Common Name': 'Norfolk Island Abutilon', 'Threatened status': 'Critically Endangered', NFI: 'Yes', 'Listed SPRAT TaxonID': '27797', Kingdom: 'Plantae', Class: 'Magnoliopsida', Family: 'Malvaceae', Genus: 'Abutilon', Profile: 'http://x?taxon_id=27797', 'Date extracted': '2026-Feb-06' }),
    row({ 'Scientific Name': 'Acacia anomala', 'Common Name': 'Grass Wattle, Chittering Grass Wattle', 'Threatened status': 'Vulnerable', WA: 'Yes', 'Listed SPRAT TaxonID': '8153', Kingdom: 'Plantae', Class: 'Magnoliopsida', Family: 'Fabaceae', Genus: 'Acacia' }),
    row({ 'Scientific Name': 'Widespread frog', 'Threatened status': 'Endangered', NSW: 'Yes', QLD: 'Yes', 'Listed SPRAT TaxonID': '55', Kingdom: 'Animalia', Class: 'Amphibia', Family: 'Myobatrachidae', Genus: 'Frog' }),
    row({ 'Scientific Name': 'No status row', 'Threatened status': '-', NSW: 'Yes', 'Listed SPRAT TaxonID': '99' }),
    row({ 'Scientific Name': 'Streptophyta sp', 'Threatened status': 'Endangered', TAS: 'Yes', 'Listed SPRAT TaxonID': '77', Kingdom: 'Plantae', Class: 'Streptophyta (no class)', Family: 'Unknownaceae', Genus: 'Strepto' }),
  ].join('\n');

  const rows = parseCsv(csv);
  const { meta, species } = buildDataset(rows, { generated: 'test' });

  it('drops rows without a recognised status', () => {
    expect(species.find((s) => s.sci === 'No status row')).toBeUndefined();
    expect(species).toHaveLength(4);
  });
  it('maps status labels to codes', () => {
    expect(species.find((s) => s.sci === 'Abutilon julianae')!.status).toBe('CR');
    expect(species.find((s) => s.sci === 'Acacia anomala')!.status).toBe('VU');
  });
  it('extracts only Yes jurisdictions', () => {
    const frog = species.find((s) => s.sci === 'Widespread frog')!;
    expect(frog.juris.sort()).toEqual(['NSW', 'QLD']);
  });
  it('cleans "(no class)" suffix', () => {
    expect(species.find((s) => s.sci === 'Streptophyta sp')!.cls).toBe('Streptophyta');
  });
  it('status counts reconcile to the total', () => {
    const sum = STATUSES.reduce((a, s) => a + (meta.byStatus[s.code] || 0), 0);
    expect(sum).toBe(meta.total);
    expect(meta.total).toBe(4);
  });
  it('kingdom counts reconcile to the total', () => {
    const sum = Object.values(meta.byKingdom).reduce((a, b) => a + b, 0);
    expect(sum).toBe(meta.total);
    expect(meta.byKingdom.Plantae).toBe(3);
    expect(meta.byKingdom.Animalia).toBe(1);
  });
  it('computes endemic (single-jurisdiction) counts per jurisdiction', () => {
    const wa = meta.jurisdictions.find((j) => j.code === 'WA')!;
    expect(wa.count).toBe(1);
    expect(wa.endemic).toBe(1); // Acacia anomala only in WA
    const nsw = meta.jurisdictions.find((j) => j.code === 'NSW')!;
    expect(nsw.count).toBe(1); // the frog
    expect(nsw.endemic).toBe(0); // frog spans NSW+QLD, not endemic
  });
  it('exposes all 17 jurisdictions and 6 statuses', () => {
    expect(JURISDICTIONS).toHaveLength(17);
    expect(STATUSES).toHaveLength(6);
    expect(meta.jurisdictions).toHaveLength(17);
  });
  it('preserves multi-part common names', () => {
    expect(species.find((s) => s.sci === 'Acacia anomala')!.common).toBe('Grass Wattle, Chittering Grass Wattle');
  });
});
