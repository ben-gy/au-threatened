import { Dataset, fmt, esc } from './data';

let el: HTMLDivElement | null = null;

export function openAbout(data: Dataset): void {
  closeAbout();
  el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="About this site">
    <button class="modal-close" type="button" aria-label="Close">×</button>
    <h2>About Threatened Species</h2>
    <p>This is every plant and animal formally listed as threatened under Australia's national environment law, the <strong>Environment Protection and Biodiversity Conservation Act 1999 (EPBC Act)</strong> — turned from a flat legal register into something you can search, map and explore.</p>

    <h3>What you're looking at</h3>
    <p>${fmt(data.meta.total)} species across ${fmt(data.meta.families)} families and ${fmt(data.meta.genera)} genera. Each carries a conservation status (from Vulnerable up to Extinct), its place in the tree of life, and the states, territories and marine areas where it is known to occur.</p>

    <h3>Where the data comes from</h3>
    <p>The <a href="${esc(data.meta.source.url)}" target="_blank" rel="noopener">EPBC Act Threatened Species State Lists</a>, published on data.gov.au by the ${esc(data.meta.source.publisher)}. Extract dated <strong>${esc(data.meta.extracted)}</strong>. State and territory boundaries are ABS ASGS 2021 (CC BY 4.0). This site refreshes from the source each quarter.</p>

    <h3>How to read it</h3>
    <ul>
      <li><strong>Status</strong> runs Vulnerable → Endangered → Critically Endangered → Extinct in the Wild → Extinct. Colours are consistent everywhere.</li>
      <li><strong>Endemic</strong> means a species occurs in one jurisdiction only — lose it there and it is gone globally.</li>
      <li>Tap any <span class="glossary-link inline-demo">term<span class="gl-icon">?</span></span> with a question mark for a plain-language explainer.</li>
    </ul>

    <h3>Important caveats</h3>
    <p>Occurrence is <em>indicative</em> — the list records where a species is broadly known to be, not a precise range map. A species with no jurisdiction flagged is still validly listed; its range simply isn't broken down this way. This is the legal list, not a live population census: it changes only when the Act's schedules are amended.</p>

    <p class="modal-foot">Built by <a href="https://benrichardson.dev/" target="_blank" rel="noopener">benrichardson.dev</a>. Not affiliated with the Australian Government.</p>
  </div>`;
  document.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add('open');
  el.addEventListener('click', (e) => { if (e.target === el) closeAbout(); });
  el.querySelector('.modal-close')!.addEventListener('click', closeAbout);
}

export function closeAbout(): void {
  if (el && el.parentElement) el.remove();
  el = null;
}
