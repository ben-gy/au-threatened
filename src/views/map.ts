import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Ctx, View } from '../app';
import { fmt, esc, AU_STATE_CODES } from '../data';

type Metric = 'total' | 'CR' | 'endemic';
const METRICS: { id: Metric; label: string; noun: string }[] = [
  { id: 'total', label: 'All listed', noun: 'threatened species' },
  { id: 'CR', label: 'Critically endangered', noun: 'critically endangered species' },
  { id: 'endemic', label: 'Found only here', noun: 'species found only in this state' },
];

const RAMP = ['#e8f0e6', '#c2ddc6', '#93c4a0', '#5aa079', '#2f7c55', '#1c5138'];

export const renderMap: View = (root: HTMLElement, ctx: Ctx) => {
  const { species, meta } = ctx.data;
  let metric: Metric = 'total';
  let map: L.Map | null = null;
  let layer: L.GeoJSON | null = null;

  // per-state metric values
  const crByState = new Map<string, number>();
  for (const s of species) if (s.status === 'CR') for (const c of s.juris) crByState.set(c, (crByState.get(c) ?? 0) + 1);
  const stateVal = (code: string, m: Metric): number => {
    const j = meta.jurisdictions.find((x) => x.code === code);
    if (!j) return 0;
    if (m === 'total') return j.count;
    if (m === 'endemic') return j.endemic;
    return crByState.get(code) ?? 0;
  };

  const externals = meta.jurisdictions.filter((j) => j.type !== 'state' && j.count > 0).sort((a, b) => b.count - a.count);

  root.innerHTML = `
    <section class="view-intro">
      <h2>Where threatened species are</h2>
      <p>Each state and territory shaded by how many listed species occur there. Switch the measure to see raw totals, the critically endangered, or the species found <em>only</em> in that state. Click a state to open its species; hover for the count.</p>
    </section>
    <div class="toolbar">
      <div class="seg-toggle" data-role="metric">
        ${METRICS.map((m, i) => `<button type="button" data-metric="${m.id}" class="${i === 0 ? 'on' : ''}">${m.label}</button>`).join('')}
      </div>
    </div>
    <div class="map-layout">
      <section class="panel map-panel">
        <div class="map-isolate"><div id="map-canvas" class="map-canvas"></div></div>
        <div id="map-legend" class="map-legend"></div>
      </section>
      <aside class="panel ext-panel">
        <div class="panel-head"><h3>Islands &amp; marine areas</h3><p>External territories and Commonwealth waters — off the map, but each with its own listed species. Click to open.</p></div>
        <div class="ext-list">
          ${externals
            .map(
              (j) => `<button class="ext-row" type="button" data-code="${j.code}" data-tip="${esc(j.name)}: ${fmt(j.count)} species, ${fmt(j.endemic)} found only here">
            <span class="ext-name">${esc(j.name)}</span>
            <span class="ext-val">${fmt(j.count)}<em>${fmt(j.endemic)} endemic</em></span>
          </button>`,
            )
            .join('')}
        </div>
      </aside>
    </div>
  `;

  const legendEl = root.querySelector('#map-legend') as HTMLElement;

  const buckets = (): number[] => {
    const vals = AU_STATE_CODES.map((c) => stateVal(c, metric)).filter((v) => v > 0).sort((a, b) => a - b);
    if (vals.length === 0) return [1, 2, 3, 4, 5];
    // quantile breaks into 5 buckets (avoids the "all one colour" trap on skew)
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    const raw = [q(0.2), q(0.4), q(0.6), q(0.8), vals[vals.length - 1]];
    const uniq: number[] = [];
    for (const v of raw) if (!uniq.includes(v)) uniq.push(v);
    while (uniq.length < 2) uniq.push((uniq[uniq.length - 1] ?? 1) + 1);
    return uniq;
  };
  let breaks = buckets();
  const colorFor = (v: number): string => {
    if (v <= 0) return '#eceae2';
    for (let i = 0; i < breaks.length; i++) if (v <= breaks[i]) return RAMP[Math.min(RAMP.length - 1, i + 1)];
    return RAMP[RAMP.length - 1];
  };

  const drawLegend = () => {
    const noun = METRICS.find((m) => m.id === metric)!.noun;
    let prev = 0;
    const items = breaks
      .map((b, i) => {
        const lo = i === 0 ? 1 : prev + 1;
        const label = lo === b ? `${fmt(b)}` : `${fmt(lo)}–${fmt(b)}`;
        prev = b;
        return `<span class="legend-item"><span class="swatch" style="background:${RAMP[Math.min(RAMP.length - 1, i + 1)]}"></span>${label}</span>`;
      })
      .join('');
    legendEl.innerHTML = `<span class="legend-title">${esc(noun)}</span>${items}<span class="legend-item"><span class="swatch" style="background:#eceae2"></span>none listed</span>`;
  };

  const style = (f: any): L.PathOptions => ({
    fillColor: colorFor(stateVal(f.properties.code, metric)),
    fillOpacity: 0.85,
    color: '#ffffff',
    weight: 1,
  });

  const tipHtml = (code: string, name: string) => {
    const j = meta.jurisdictions.find((x) => x.code === code);
    return `<strong>${esc(name)}</strong><br>${fmt(j?.count ?? 0)} listed · ${fmt(crByState.get(code) ?? 0)} critically endangered<br>${fmt(j?.endemic ?? 0)} found only here`;
  };

  const initMap = async () => {
    const canvas = root.querySelector('#map-canvas') as HTMLElement;
    map = L.map(canvas, { minZoom: 3, maxZoom: 8, zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: 'Tiles © CARTO · Boundaries: ABS ASGS (CC BY 4.0) · Species: EPBC Act list, DCCEEW',
      subdomains: 'abcd',
      minZoom: 3,
      maxZoom: 8,
    }).addTo(map);

    let geo: any;
    try {
      geo = await fetch('data/boundaries.geojson').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    } catch {
      canvas.innerHTML = '<div class="map-error">Could not load the map boundaries.</div>';
      return;
    }

    layer = L.geoJSON(geo, {
      style,
      onEachFeature: (f: any, lyr: any) => {
        const code = f.properties.code;
        const name = f.properties.name;
        lyr.bindTooltip(tipHtml(code, name), { sticky: true, className: 'map-tip' });
        lyr.on({
          mouseover: () => lyr.setStyle({ weight: 2.5, color: '#1c3a29' }),
          mouseout: () => layer && layer.resetStyle(lyr),
          click: () => ctx.openState(code),
        });
      },
    }).addTo(map);

    const bounds = layer.getBounds();
    const fit = () => { map!.invalidateSize(); if (bounds.isValid() && canvas.clientHeight > 50) map!.fitBounds(bounds, { padding: [10, 10] }); };
    const ro = new ResizeObserver(() => { if (canvas.clientHeight > 50) { fit(); ro.disconnect(); } });
    ro.observe(canvas);
    setTimeout(fit, 400);
  };

  const restyle = () => {
    breaks = buckets();
    drawLegend();
    if (layer) layer.setStyle(style as any);
    if (layer && map) {
      layer.eachLayer((lyr: any) => {
        const f = lyr.feature;
        lyr.setTooltipContent(tipHtml(f.properties.code, f.properties.name));
      });
    }
  };

  root.querySelector('[data-role="metric"]')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    metric = b.getAttribute('data-metric') as Metric;
    root.querySelectorAll('[data-role="metric"] button').forEach((x) => x.classList.toggle('on', x === b));
    restyle();
  });
  root.querySelectorAll<HTMLElement>('.ext-row').forEach((el) =>
    el.addEventListener('click', () => ctx.openExplorer({ juris: el.getAttribute('data-code') ?? undefined })),
  );

  drawLegend();
  void initMap();

  return () => { if (map) { map.remove(); map = null; } };
};
