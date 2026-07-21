# Site Plan: Threatened Species

## Overview
- **Name:** Threatened Species
- **Repo name:** au-threatened
- **Tagline:** Every plant and animal Australia lists as threatened — by conservation status, family tree, and where each one lives, straight from the EPBC Act.

### Naming Convention
Plain topic name "Threatened Species". Country lives in the index `country: "AU"` field (flag). No country code in the display name.

## Target Audience
Curious general public, students and teachers, bushwalkers and naturalists, journalists, and conservation-minded citizens who want to know what's endangered in Australia, where, and how bad it is — without wading through a government legal register. Mostly on phones and laptops, low domain knowledge, emotionally invested in nature.

## Value Proposition
The official EPBC Act list is a flat legal spreadsheet. This turns it into an explorable atlas: search any species, see the whole tree of life ranked by imperilment, map where threatened species cluster, and — the unique angle — see which species are found in **one place only** (endemic) and would be lost from Earth if that place changed. Nowhere else lets a non-expert cut this list by status, taxonomy, and geography at once.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| EPBC Act Threatened Species State Lists | data.gov.au dataset ae652011 (20260206spcs.csv) | 2,208 listed species: name, common name, threatened status, per-state/territory + marine occurrence, Kingdom/Class/Family/Genus, SPRAT profile link | Amended a few times/year | No |
| ABS ASGS state boundaries | patterns/geo/au-states.geojson | Real state/territory polygons for the choropleth | Static | No |

## Key Features
1. Overview / status pyramid — 2,208 species across Extinct → Critically Endangered → Endangered → Vulnerable, with the plants-vs-animals surprise (1,514 plants vs 694 animals).
2. Leaflet state choropleth (total / critically endangered / endemic-only) + external-territory panel (Norfolk Is, Christmas Is…).
3. Rankings — most-imperilled families, classes, genera, and states, with a metric toggle.
4. Tree of Life — click-to-zoom squarified treemap Kingdom → Class → Family.
5. Endemism — the signature view: 77% of species occur in a single jurisdiction; per-state endemic-only counts + the jurisdiction-span histogram.
6. Cross-reference matrix — Class × State heatmap.
7. Explorer — searchable, filterable table of all 2,208 species with drill-down.
8. Insights — auto-detected findings (families that are 100% critically endangered, extinction hotspots, endemism burden).

## Target Audience (detailed)
A parent helping a kid with a school project on endangered animals; a bushwalker who just saw an unfamiliar orchid; a local journalist checking what's threatened in their electorate; a teacher building a lesson. Phone-first, impatient, no ecology jargon assumed — every term gets an inline explainer. The emotional register is care and mild alarm, so the design is warm and clear, not clinical or alarmist.

## Style Direction
**Tone:** friendly / civic-natural-history — a modern field guide.
**Colour palette:** warm paper (#faf8f2) with deep forest-ink text and a forest-green accent; IUCN-style status ramp (Extinct charcoal → Critically Endangered red → Endangered orange → Vulnerable amber → Conservation Dependent lime) used consistently as the categorical scale everywhere; Plantae green vs Animalia amber for kingdom. Evokes a natural-history museum plate.
**UI density:** balanced — roomy cards on overview, denser tables in Explorer.
**Dark/light theme:** light.
**Reference sites for tone:** the Atlas of Living Australia, a printed field guide / natural-history museum label.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite.
- **Data strategy:** pipeline — quarterly cron (source is amended a few times a year; quarterly is proportional and well within the monthly-fastest rule). Pipeline fetches the CSV, parses with its own dependency-free RFC-4180 reader, and emits `public/data/species.json` + copies the state GeoJSON. Frontend runtime-fetches the JSON.
- **Key libraries:** Leaflet (map) only. All other charts hand-rolled SVG. Treemap/tooltip/svgZoom from patterns/.

## Layout
Fixed header (title + view tabs + About/? button). Main content max-width ~1500px, flex-column so the footer sticks. Views stack panels; on mobile tabs scroll horizontally and panels go single-column. Explorer table lives in its own overflow-x scroller.

## Pages/Views
Single page, hash-routed tabs (#v=overview|map|rankings|tree|endemism|matrix|explorer|insights) plus drill-downs #s=<taxonId> (species) and #state=<CODE>.

## Visualization Strategy
- **Status pyramid / segmented bar** (Overview) — answers "how imperilled, and what kinds of life?" Click a status segment → filtered Explorer. Plants-vs-animals split within each status is the counter-intuitive hook.
- **Leaflet choropleth** (Map) — answers "where are threatened species concentrated?" Real ABS polygons, hover tooltip per state, click → state drill-down. External territories (not on the state map) shown as a ranked side panel because they carry outsized endemic loads.
- **Ranked horizontal bars** (Rankings) — answers "which families/classes/genera/states carry the most?" Metric + group toggle; every bar hover-tips exact counts; click → Explorer filtered to that group.
- **Squarified treemap, click-to-zoom** (Tree of Life) — answers "which branches of the tree of life are most threatened?" Kingdom→Class→Family hierarchy; colour by kingdom; every tile hover-tips; click zooms a level; selection drills the Explorer.
- **Diverging bars + histogram** (Endemism) — answers "which places hold species found nowhere else?" Per-state endemic-only vs shared, plus the span histogram (how many jurisdictions each species spans). The unique story a league table can't tell.
- **Class × State heatmap matrix** (Matrix) — answers "what's the geography of each animal/plant group?" Cell intensity = count, hover exact, click → Explorer filtered to that class+state.
- **Searchable table** (Explorer) — always-include; sortable, filterable, sparkline-free (no time series in this data) with status pills and jurisdiction chips.
- **Insight cards** (Insights) — anomaly detection surfaced as prose.

No time-series view: the source carries no per-species listing date, so a timeline would be fabricated — deliberately omitted. No force-graph: species don't connect to each other, so a co-occurrence network would be a structureless dot-cloud (explicitly discouraged); the treemap + matrix carry the relational load instead.
