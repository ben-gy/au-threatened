// Glossary terms + inline click-to-explain popovers. Follows the Artemis
// Tracker pattern: `.glossary-link` spans carry a data-term; one fixed popover
// is positioned near the clicked term and dismissed on outside-click / Escape.

export const GLOSSARY: Record<string, { title: string; body: string }> = {
  epbc: {
    title: 'EPBC Act',
    body: 'The Environment Protection and Biodiversity Conservation Act 1999 — Australia’s national environmental law. A species listed under it is legally recognised as threatened, which triggers protections and recovery planning.',
  },
  threatened: {
    title: 'Threatened species',
    body: 'A plant or animal at risk of extinction, formally listed in one of the EPBC Act categories (Vulnerable, Endangered, Critically Endangered, Extinct in the Wild, or Extinct).',
  },
  cr: {
    title: 'Critically Endangered',
    body: 'The most severe living category: facing an extremely high risk of extinction in the wild in the immediate future.',
  },
  en: {
    title: 'Endangered',
    body: 'Facing a very high risk of extinction in the wild in the near future.',
  },
  vu: {
    title: 'Vulnerable',
    body: 'Facing a high risk of extinction in the wild over the medium term. The entry point of the threatened list.',
  },
  ew: {
    title: 'Extinct in the Wild',
    body: 'Survives only in cultivation, in captivity, or as a population well outside its former range — gone from the wild.',
  },
  cd: {
    title: 'Conservation Dependent',
    body: 'Not currently threatened only because a specific conservation programme is keeping it stable. Remove the programme and it would qualify as threatened.',
  },
  endemic: {
    title: 'Endemic',
    body: 'Found naturally in one place and nowhere else on Earth. Here it means a species listed in a single Australian state, territory or marine area — if it is lost there, it is lost globally.',
  },
  taxonomy: {
    title: 'Taxonomy',
    body: 'The nested classification of life. From broad to narrow: Kingdom → Class → Family → Genus → Species. Two species in the same genus are close relatives; the same family, more distant.',
  },
  kingdom: {
    title: 'Kingdom',
    body: 'The broadest grouping used here — Plantae (plants) or Animalia (animals). Plants make up roughly two-thirds of Australia’s threatened list, which surprises most people.',
  },
  class: {
    title: 'Class',
    body: 'A major branch of the tree of life. Examples: Aves (birds), Mammalia (mammals), Reptilia (reptiles), Magnoliopsida (flowering dicot plants).',
  },
  family: {
    title: 'Family',
    body: 'A group of related genera. Some families — like the wattles (Fabaceae) or eucalypts and their kin (Myrtaceae) — carry a large share of the threatened list.',
  },
  genus: {
    title: 'Genus',
    body: 'A group of closely related species. It is the first half of the two-part scientific name (e.g. Acacia in Acacia anomala).',
  },
  sprat: {
    title: 'SPRAT',
    body: 'The Species Profile and Threats Database — the government’s per-species reference. Each species here links out to its full SPRAT profile.',
  },
  jurisdiction: {
    title: 'Jurisdiction',
    body: 'A state, territory or marine area where a species is indicatively known to occur, according to the EPBC list. A species can be listed in several.',
  },
  marine: {
    title: 'Commonwealth Marine Area',
    body: 'Commonwealth waters generally beyond 3 nautical miles from shore. Listed separately from the states because it has no state boundary of its own.',
  },
};

let popover: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'glossary-pop';
    popover.setAttribute('role', 'dialog');
    document.body.appendChild(popover);
  }
  return popover;
}

export function hideGlossary(): void {
  if (popover) popover.classList.remove('visible');
}

function show(term: string, anchor: Element): void {
  const g = GLOSSARY[term];
  if (!g) return;
  const el = ensure();
  el.innerHTML = `<h4>${g.title}</h4><p>${g.body}</p>`;
  el.classList.add('visible');
  const r = anchor.getBoundingClientRect();
  const pad = 10;
  const w = Math.min(320, window.innerWidth - pad * 2);
  el.style.width = `${w}px`;
  let left = r.left;
  if (left + w + pad > window.innerWidth) left = window.innerWidth - w - pad;
  left = Math.max(pad, left);
  el.style.left = `${left}px`;
  // prefer below; flip above if it would overflow
  const belowTop = r.bottom + 8;
  el.style.top = `${belowTop}px`;
  const h = el.getBoundingClientRect().height;
  if (belowTop + h + pad > window.innerHeight && r.top - h - 8 > pad) {
    el.style.top = `${r.top - h - 8}px`;
  }
}

/** Build an inline glossary-link span (returns HTML string). */
export function gl(term: string, text: string): string {
  return `<span class="glossary-link" data-term="${term}" tabindex="0" role="button" aria-label="What is ${text}?">${text}<span class="gl-icon" aria-hidden="true">?</span></span>`;
}

export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('.glossary-link');
    if (link) {
      e.stopPropagation();
      show(link.getAttribute('data-term') ?? '', link);
      return;
    }
    if (popover && !(e.target as Element).closest('.glossary-pop')) hideGlossary();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideGlossary();
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.classList.contains('glossary-link')) {
      e.preventDefault();
      show(document.activeElement.getAttribute('data-term') ?? '', document.activeElement);
    }
  });
  window.addEventListener('resize', hideGlossary);
  window.addEventListener('scroll', hideGlossary, true);
}
