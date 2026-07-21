import type { Ctx, View, Filter } from '../app';
import { STATUS, STATUS_ORDER, StatusCode, fmt, esc, groupBy, jurisName } from '../data';
import { barList, statusLegend } from '../charts';

type GroupId = 'family' | 'cls' | 'genus' | 'state';
const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'family', label: 'Families' },
  { id: 'cls', label: 'Classes' },
  { id: 'genus', label: 'Genera' },
  { id: 'state', label: 'States & territories' },
];

export const renderRankings: View = (root: HTMLElement, ctx: Ctx) => {
  const { species, meta } = ctx.data;
  let group: GroupId = 'family';
  let metric: 'total' | StatusCode = 'total';

  root.innerHTML = `
    <section class="view-intro">
      <h2>Rankings</h2>
      <p>Which groups and places carry the heaviest load of threatened species? Switch the grouping and the measure. Click any bar to open those species.</p>
    </section>
    <div class="toolbar">
      <div class="seg-toggle" data-role="group">
        ${GROUPS.map((g, i) => `<button type="button" data-group="${g.id}" class="${i === 0 ? 'on' : ''}">${g.label}</button>`).join('')}
      </div>
      <div class="seg-toggle" data-role="metric">
        <button type="button" data-metric="total" class="on">All statuses</button>
        ${STATUS_ORDER.map((c) => `<button type="button" data-metric="${c}" title="${esc(STATUS[c].label)}" style="--chip:${STATUS[c].color}">${STATUS[c].short}</button>`).join('')}
      </div>
    </div>
    <section class="panel">
      <div class="panel-head"><h3 id="rank-title"></h3><p id="rank-sub"></p></div>
      <div id="rank-body"></div>
      ${statusLegend()}
    </section>
  `;

  const title = root.querySelector('#rank-title') as HTMLElement;
  const sub = root.querySelector('#rank-sub') as HTMLElement;
  const body = root.querySelector('#rank-body') as HTMLElement;

  const draw = () => {
    const accessor =
      group === 'state'
        ? null
        : group === 'family'
          ? (s: (typeof species)[number]) => s.family
          : group === 'cls'
            ? (s: (typeof species)[number]) => s.cls
            : (s: (typeof species)[number]) => s.genus;

    let rows: { key: string; label: string; total: number; byStatus: Record<StatusCode, number> }[];
    if (group === 'state') {
      rows = meta.jurisdictions.map((j) => {
        const b = { EX: 0, EW: 0, CR: 0, EN: 0, VU: 0, CD: 0 } as Record<StatusCode, number>;
        for (const s of species) if (s.juris.includes(j.code)) b[s.status]++;
        const total = STATUS_ORDER.reduce((a, c) => a + b[c], 0);
        return { key: j.code, label: `${j.name} (${j.code})`, total, byStatus: b };
      });
    } else {
      rows = groupBy(species, accessor!).map((g) => ({ key: g.key, label: g.key, total: g.total, byStatus: g.byStatus }));
    }

    const value = (r: (typeof rows)[number]) => (metric === 'total' ? r.total : r.byStatus[metric]);
    rows = rows.filter((r) => value(r) > 0).sort((a, b) => value(b) - value(a) || a.label.localeCompare(b.label));
    const shown = rows.slice(0, 25);

    const groupLabel = GROUPS.find((g) => g.id === group)!.label.toLowerCase();
    const metricLabel = metric === 'total' ? 'all listed species' : STATUS[metric].label;
    title.textContent = `Top ${groupLabel} by ${metric === 'total' ? 'listings' : STATUS[metric].label}`;
    sub.textContent = `${rows.length.toLocaleString('en-AU')} ${groupLabel} have at least one ${metric === 'total' ? 'listed species' : metricLabel + ' species'}. Showing the top ${shown.length}.`;

    body.innerHTML = barList(
      shown.map((r) => ({
        key: r.key,
        label: r.label,
        value: value(r),
        color: metric === 'total' ? '#256848' : STATUS[metric].color,
        byStatus: metric === 'total' ? r.byStatus : undefined,
        sub: metric === 'total' ? undefined : `of ${fmt(r.total)} listed`,
        tip:
          group === 'state'
            ? `${jurisName(ctx.data, r.key)}: ${fmt(value(r))} ${metricLabel}`
            : `${r.label}: ${fmt(value(r))} ${metricLabel} — ${STATUS_ORDER.filter((c) => r.byStatus[c]).map((c) => `${r.byStatus[c]} ${STATUS[c].short}`).join(', ')}`,
      })),
    );

    body.querySelectorAll<HTMLElement>('.bar-row').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-key') ?? '';
        const f: Filter = metric === 'total' ? {} : { status: metric };
        if (group === 'family') f.family = key;
        else if (group === 'cls') f.cls = key;
        else if (group === 'genus') f.genus = key;
        else if (group === 'state') f.juris = key;
        ctx.openExplorer(f);
      });
    });
  };

  root.querySelector('[data-role="group"]')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    group = b.getAttribute('data-group') as GroupId;
    root.querySelectorAll('[data-role="group"] button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });
  root.querySelector('[data-role="metric"]')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    metric = b.getAttribute('data-metric') as any;
    root.querySelectorAll('[data-role="metric"] button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });

  draw();
};
