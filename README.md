# Threatened Species

**Every plant and animal Australia lists as threatened — by conservation status, family tree, and where each one lives, straight from the EPBC Act.**

🔗 **Live:** [https://au-threatened.benrichardson.dev](https://au-threatened.benrichardson.dev)

## What is this?

Australia's national environment law, the *Environment Protection and Biodiversity Conservation Act 1999* (EPBC Act), keeps a legal register of every species at risk of extinction. It's the list that decides what the country protects — but it ships as a flat spreadsheet that's hard for anyone outside government to read.

This turns that register into an atlas you can explore. All 2,208 listed species, each with its conservation status (from Vulnerable up to Extinct), its place in the tree of life (Kingdom → Class → Family → Genus), and the states, territories and marine areas where it's known to occur. Search any species, rank the most-imperilled branches of life, map where threatened species cluster, and — the angle nothing else surfaces — see which species are **endemic**: found in one place only, so if they're lost there, they're gone from Earth.

Two findings carry the site. First, plants dominate: 1,514 of the listed species are plants against 694 animals, roughly two to one — the opposite of where public attention goes. Second, 77% of listed species occur in a single jurisdiction, which makes some places irreplaceable in a way a raw species count can never show.

## Who is this for?

Curious members of the public, students and teachers, bushwalkers and naturalists, journalists covering the environment, and anyone who wants to understand what's endangered in Australia — where, how badly, and what kind of life it is — without wading through a legal schedule. Every piece of jargon has an inline plain-language explainer.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [EPBC Act Threatened Species State Lists](https://data.gov.au/data/dataset/threatened-species-state-lists) (DCCEEW, via data.gov.au) | Every listed species: name, common name, conservation status, per-state/territory/marine occurrence, taxonomy, and SPRAT profile link | Amended a few times per year (extract dated 2026-02-06) |
| ABS ASGS 2021 state & territory boundaries | Real polygons for the choropleth map | Static |

## Features

- **Overview** — the status pyramid, the plants-vs-animals split, and the most-affected classes at a glance.
- **Map** — a Leaflet choropleth of every state and territory (total / critically endangered / endemic-only), plus an islands-and-marine panel for the external territories that sit off the map.
- **Rankings** — leaderboards of the most-imperilled families, classes, genera and states, with a status-metric toggle.
- **Tree of Life** — a click-to-zoom treemap through Kingdom → Class → Family.
- **Endemism** — the signature view: per-place counts of species found nowhere else, plus the how-widespread distribution.
- **Matrix** — a Class × jurisdiction heatmap.
- **Explorer** — a searchable, filterable table of all 2,208 species with a per-species drill-down.
- **Insights** — auto-detected findings (mammal extinctions, whole families near the brink, endemism hotspots).

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (parser, aggregation, analysis, and positional treemap layout tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline — a dependency-free collector fetches and parses the source CSV each quarter into `public/data/species.json`
- **Maps:** Leaflet + real ABS GeoJSON

## Local Development

```bash
npm install      # install dependencies
npm run dev      # start dev server
npm test         # run tests
npm run build    # production build
npm run preview  # preview the production build

node pipeline/collect.mjs   # refresh public/data/species.json from source
```

## How it works

`pipeline/collect.mjs` downloads the EPBC list, parses it with its own RFC-4180 reader (`pipeline/parse.mjs`, shared with the test suite), aggregates counts, and asserts the status and kingdom totals reconcile before writing `public/data/species.json` — the build fails on drift. The frontend fetches that JSON at load and computes every view client-side; there is no backend.

## License

MIT
