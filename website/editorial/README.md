# Maison Vérane — photography studio site

A bilingual (FR/EN) portfolio for a Paris fashion photography studio. Plain
static HTML, CSS and JavaScript: no build step, no dependencies.

**Placeholder content.** The studio name, crews, clients and every contact
detail are invented (emails use the reserved `example.com` domain, phone
numbers are zeros). The photographs are from [Pexels](https://www.pexels.com/)
and stand in for the studio's own work. Replace both before launch.

## Pages

| Route              | Page                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `#/`               | Index: series list beside a large photograph                      |
| `#/serie/<id>/<n>` | One series, one photograph at a time, with crew credits           |
| `#/grille`         | Every photograph in a masonry grid, filtered by category          |
| `#/studio`         | Manifesto, services, approach and clients                         |
| `#/contact`        | Studio email, address, phone and agents in Paris, London, New York |

In a series, click the right or left half of the photograph (or use the arrow
keys) to step; Esc returns to the index. The cursor label uses a difference
blend, so it reads light over photographs and dark over the page.

## Editing

- `data.js`: studio details (`STUDIO`) and the series (`SERIES`). Each photo
  needs its `src`, its ratio `r` (width ÷ height) and `alt` text.
- `app.js`: interface text in French and English (`STR`), routing and views.
- `styles.css`: layout, type and motion.
- `assets/photos/`: the photographs.

## Preview

```sh
npx serve .
```
