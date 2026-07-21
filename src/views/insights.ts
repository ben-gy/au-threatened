import type { Ctx, View } from '../app';
import { esc } from '../data';
import { computeInsights } from '../analysis';

export const renderInsights: View = (root: HTMLElement, ctx: Ctx) => {
  const insights = computeInsights(ctx.data);
  root.innerHTML = `
    <section class="view-intro">
      <h2>What the data reveals</h2>
      <p>Findings pulled automatically from the full list — the patterns a flat register hides.</p>
    </section>
    <div class="insight-grid">
      ${insights
        .map(
          (it, i) => `<article class="insight-card sev-${it.severity}" data-i="${i}">
        <span class="insight-badge">${it.severity}</span>
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.body)}</p>
        ${it.action ? `<button class="insight-action" type="button" data-i="${i}">${esc(it.action.label)} →</button>` : ''}
      </article>`,
        )
        .join('')}
    </div>
  `;
  root.querySelectorAll<HTMLElement>('.insight-action').forEach((b) =>
    b.addEventListener('click', () => {
      const it = insights[Number(b.getAttribute('data-i'))];
      if (it.action) ctx.openExplorer(it.action.filter);
    }),
  );
};
