# Sundar Rajan — portfolio

A minimal portfolio: the photographs carry the site. Plain static HTML, CSS
and JavaScript, with no build step and no dependencies.

| Route                 | Page                                                     |
| --------------------- | -------------------------------------------------------- |
| `#/`                  | Landing slideshow (16 photographs, slow crossfade)       |
| `#/work`              | Project covers                                           |
| `#/work/<project>/<n>` | One project, one photograph at a time                    |
| `#/info`              | Bio and contact                                          |

The opening shows the name alone, then reveals the first photograph. It plays
once per visit; add `?intro` to the URL to see it again.

## Editing

- `data.js` lists every photograph and its ratio. It is generated from the
  files in `photos/`; regenerate it after adding or removing photographs.
- `app.js` holds the bio and the contact details (`CONTACT`).
- Photographs come from the "Website - Materials" Drive folder, resized to
  2000px (landing) and 1800px (projects).
