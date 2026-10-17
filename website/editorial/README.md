# REA editorial site

A gallery-style edition of the REA website. Each investigation is presented as a
"work" with a sequence of prints, in the manner of a photography portfolio:

- **Intro** — a quick run of prints before the index (once per browser session;
  skipped with reduced motion or a click).
- **Index** — one featured print beside a list of works; hovering a work previews
  it, and the panel has Works and Info tabs.
- **Work** — one print at a time. Click the right or left half (or use the arrow
  keys) to step; Esc returns to the index.
- **Thumbnails** — every print in a three-column grid (two on phones).

It is plain static HTML, CSS and JavaScript with no build step or dependencies.

| File         | Contents                                                        |
| ------------ | --------------------------------------------------------------- |
| `works.js`   | The works, their text, links and plate definitions              |
| `plates.js`  | Draws generated plates (code, hex, ring, curve, OTP, graph, …) |
| `app.js`     | Routing (`#/`, `#/info`, `#/thumbnails`, `#/works/<id>/<n>`), views, intro, cursor |
| `styles.css` | Layout, print finish, motion and small-screen rules             |
| `assets/`    | Figures and screenshots copied from `website/public` and `docs/assets` |

Plates of type `img` use the real figures and screenshots; the others are drawn
from the code, bytes and numbers each showcase recovered. To add a work, append
an entry to `window.REA_WORKS` in `works.js`.

## Preview

Serve the folder with any static server, for example:

```sh
npx serve website/editorial
```
