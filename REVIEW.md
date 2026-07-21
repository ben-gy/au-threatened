# Threatened Species — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-threatened/ *(redirects to the custom domain once DNS is set)*
- **Custom domain:** https://au-threatened.benrichardson.dev

## What it is

Every plant and animal on Australia's EPBC Act threatened-species list (2,208 species), turned from a flat legal register into an explorable atlas — status pyramid, Leaflet state map, rankings, a click-to-zoom Tree of Life treemap, the signature Endemism view, a Class × jurisdiction matrix, a searchable Explorer, and auto-detected insights, with per-species and per-state drill-downs.

## DNS (already provisioned this run)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-threatened` | `ben-gy.github.io` | DNS only (grey cloud) |

If the TLS cert is still issuing, re-trigger with:
```bash
gh api repos/ben-gy/au-threatened/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/au-threatened/pages -X PUT -f cname="au-threatened.benrichardson.dev"
```
