import type { Ctx, View } from '../app';
import { STATUS, STATUS_ORDER, fmt, pct, groupBy } from '../data';
import { statusSegmentBar, statusLegend, barList } from '../charts';
import { gl } from '../glossary';

export const renderOverview: View = (root: HTMLElement, ctx: Ctx) => {
  const { meta, species } = ctx.data;
  const plants = meta.byKingdom['Plantae'] ?? 0;
  const animals = meta.byKingdom['Animalia'] ?? 0;
  const living = meta.total - meta.byStatus.EX - meta.byStatus.EW;
  const plantsPct = pct(plants / meta.total, 0);

  const plantSpecies = species.filter((s) => s.kingdom === 'Plantae');
  const animalSpecies = species.filter((s) => s.kingdom === 'Animalia');
  const statusOf = (list: typeof species) => {
    const b = { EX: 0, EW: 0, CR: 0, EN: 0, VU: 0, CD: 0 } as Record<string, number>;
    for (const s of list) b[s.status]++;
    return b as any;
  };

  const classes = groupBy(species, (s) => s.cls).slice(0, 10);
  const classBars = barList(
    classes.map((g) => ({
      key: g.key,
      label: g.key,
      value: g.total,
      color: '#256848',
      byStatus: g.byStatus,
      tip: `${g.key}: ${fmt(g.total)} listed — ${STATUS_ORDER.filter((c) => g.byStatus[c]).map((c) => `${g.byStatus[c]} ${STATUS[c].short}`).join(', ')}`,
    })),
  );

  root.innerHTML = `
    <section class="view-intro">
      <h2>The state of Australia's threatened wildlife</h2>
      <p>
        ${fmt(meta.total)} plants and animals are formally listed as ${gl('threatened', 'threatened')}
        under the ${gl('epbc', 'EPBC Act')} — the register that decides what Australian law protects.
        <strong>${fmt(meta.byStatus.CR)}</strong> are ${gl('cr', 'Critically&nbsp;Endangered')} and
        <strong>${fmt(meta.byStatus.EX + meta.byStatus.EW)}</strong> are already extinct or gone from the wild.
        And the biggest surprise: <strong>${plantsPct} of the list is plants</strong>, not animals.
      </p>
    </section>

    <section class="stat-grid">
      <button class="stat-card" data-jump="explorer" data-filter="all">
        <span class="stat-num">${fmt(meta.total)}</span>
        <span class="stat-lab">species listed</span>
        <span class="stat-hint">${fmt(meta.families)} families · ${fmt(meta.genera)} genera</span>
      </button>
      <button class="stat-card accent-cr" data-jump="explorer" data-filter="CR">
        <span class="stat-num">${fmt(meta.byStatus.CR)}</span>
        <span class="stat-lab">critically endangered</span>
        <span class="stat-hint">${pct(meta.byStatus.CR / meta.total, 0)} of the list</span>
      </button>
      <button class="stat-card accent-ex" data-jump="explorer" data-filter="EX">
        <span class="stat-num">${fmt(meta.byStatus.EX + meta.byStatus.EW)}</span>
        <span class="stat-lab">extinct / extinct in wild</span>
        <span class="stat-hint">${fmt(meta.byStatus.EX)} extinct · ${fmt(meta.byStatus.EW)} in the wild</span>
      </button>
      <button class="stat-card" data-jump="explorer" data-filter="Plantae">
        <span class="stat-num">${plantsPct}</span>
        <span class="stat-lab">are plants</span>
        <span class="stat-hint">${fmt(plants)} plants · ${fmt(animals)} animals</span>
      </button>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>By conservation status</h3>
        <p>Every listed species, sorted from most to least imperilled. ${living.toLocaleString('en-AU')} are still hanging on in the wild. Click a band to see those species.</p>
      </div>
      ${statusSegmentBar(meta.byStatus, { clickable: true })}
      ${statusLegend()}
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Plants versus animals</h3>
        <p>Endangered animals get the attention, but plants dominate the list — and skew more heavily toward the critical end. Each bar shows one kingdom's status mix.</p>
      </div>
      <div class="kv-bars">
        <div class="kv-row">
          <span class="kv-name">🌿 Plants<span class="kv-count">${fmt(plants)}</span></span>
          ${statusSegmentBar(statusOf(plantSpecies))}
        </div>
        <div class="kv-row">
          <span class="kv-name">🦎 Animals<span class="kv-count">${fmt(animals)}</span></span>
          ${statusSegmentBar(statusOf(animalSpecies))}
        </div>
      </div>
      ${statusLegend()}
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Most-affected branches of life</h3>
        <p>The ${gl('class', 'classes')} carrying the most listed species. Bars are split by status severity; click one to explore it.</p>
      </div>
      ${classBars}
    </section>
  `;

  root.querySelectorAll<HTMLElement>('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const f = card.getAttribute('data-filter');
      if (f === 'all') ctx.openExplorer({});
      else if (f === 'Plantae') ctx.openExplorer({ kingdom: 'Plantae' });
      else if (f === 'EX') ctx.openExplorer({ status: 'EX' });
      else if (f) ctx.openExplorer({ status: f as any });
    });
  });
  root.querySelectorAll<HTMLElement>('.seg-bar.clickable .seg').forEach((seg) => {
    seg.addEventListener('click', () => ctx.openExplorer({ status: seg.getAttribute('data-key') as any }));
  });
  root.querySelectorAll<HTMLElement>('.bar-row').forEach((row) => {
    row.addEventListener('click', () => ctx.openExplorer({ cls: row.getAttribute('data-key') ?? undefined }));
  });
};
