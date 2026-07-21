import { describe, expect, it } from 'vitest';
import { groupBy, jurisCounts, endemicCounts, spanHistogram, STATUS, STATUS_ORDER, Species } from '../src/data';
import { zoomViewBox, clampViewBox } from '../src/utils/svgZoom';

const sp = (o: Partial<Species>): Species => ({
  id: o.id ?? 'x', sci: o.sci ?? 'Genus species', cur: '', common: o.common ?? '',
  status: o.status ?? 'VU', kingdom: o.kingdom ?? 'Plantae', cls: o.cls ?? 'Magnoliopsida',
  family: o.family ?? 'Fabaceae', genus: o.genus ?? 'Acacia', juris: o.juris ?? ['WA'], profile: '',
});

const data: Species[] = [
  sp({ id: '1', status: 'CR', family: 'Fabaceae', juris: ['WA'] }),
  sp({ id: '2', status: 'VU', family: 'Fabaceae', juris: ['WA', 'SA'] }),
  sp({ id: '3', status: 'EN', family: 'Myrtaceae', juris: ['NSW'] }),
  sp({ id: '4', status: 'CR', family: 'Myrtaceae', juris: ['NSW', 'QLD', 'VIC'] }),
  sp({ id: '5', status: 'EX', family: 'Fabaceae', juris: [] }),
];

describe('groupBy', () => {
  it('counts totals and per-status, sorted desc', () => {
    const g = groupBy(data, (s) => s.family);
    expect(g[0].key).toBe('Fabaceae');
    expect(g[0].total).toBe(3);
    expect(g[0].byStatus.CR).toBe(1);
    expect(g[0].byStatus.EX).toBe(1);
  });
  it('falls back to Unknown for empty keys', () => {
    const g = groupBy([sp({ family: '' })], (s) => s.family);
    expect(g[0].key).toBe('Unknown');
  });
});

describe('jurisCounts', () => {
  it('counts every jurisdiction a species touches', () => {
    const m = jurisCounts(data);
    expect(m.get('WA')).toBe(2);
    expect(m.get('NSW')).toBe(2);
    expect(m.get('QLD')).toBe(1);
  });
  it('filters by status', () => {
    const m = jurisCounts(data, 'CR');
    expect(m.get('WA')).toBe(1);
    expect(m.get('NSW')).toBe(1);
    expect(m.get('SA')).toBeUndefined();
  });
});

describe('endemicCounts', () => {
  it('only counts species in exactly one jurisdiction', () => {
    const m = endemicCounts(data);
    expect(m.get('WA')).toBe(1); // id 1 only
    expect(m.get('NSW')).toBe(1); // id 3 only
    expect(m.get('SA')).toBeUndefined(); // id 2 spans two
  });
});

describe('spanHistogram', () => {
  it('bins by number of jurisdictions', () => {
    const bins = spanHistogram(data);
    expect(bins[0]).toBe(1); // id 5 has no jurisdiction
    expect(bins[1]).toBe(2); // ids 1,3
    expect(bins[2]).toBe(1); // id 2
    expect(bins[3]).toBe(1); // id 4
  });
});

describe('status metadata', () => {
  it('orders severity from Extinct to Conservation Dependent', () => {
    expect(STATUS_ORDER[0]).toBe('EX');
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('CD');
    for (const c of STATUS_ORDER) expect(STATUS[c].color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('zoomViewBox math', () => {
  const base = { x: 0, y: 0, w: 100, h: 100 };
  it('zooms in toward a focus point and stays clamped in-bounds', () => {
    const z = zoomViewBox(base, base, 2, 50, 50, 1, 8);
    expect(z.w).toBeCloseTo(50);
    expect(z.x).toBeGreaterThanOrEqual(0);
    expect(z.x + z.w).toBeLessThanOrEqual(100 + 1e-9);
  });
  it('never zooms out past the base box', () => {
    const z = zoomViewBox(base, base, 0.5, 50, 50, 1, 8);
    expect(z.w).toBeLessThanOrEqual(100);
  });
  it('clamps a panned box back inside the base', () => {
    const c = clampViewBox({ x: -40, y: 200, w: 50, h: 50 }, base);
    expect(c.x).toBe(0);
    expect(c.y).toBe(50);
  });
});
