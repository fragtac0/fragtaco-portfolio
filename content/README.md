# Content Guide

This portfolio uses git-backed content files so routine updates do not require React or route changes. Invalid content fails when it is loaded and in the tests (`app/content/schemas.ts`).

## Directory layout

- `content/site/home.json`: hero copy, about card and credits card
- `content/site/books.json`: the books on the shelf
- `content/site/videos.json`: the videos on the wall (written by `yarn sync:videos`, do not edit by hand)
- `content/site/hero-paintings.json`: the hero paintings
- `content/site/work.json`: the work page (intro, tools, long and short videos, clients)
- `content/site/experience.json`: the My experience page (the words, the moments, the Mars map's route, places and facts)
- `content/site/reach-out.json`: contact funnels and CTAs (not shown on a page yet)
- `content/site/navigation.json`: primary navigation items
- `content/site/social-links.json`: reusable outbound profile links

## Work page (`work.json`)

- `intro`: `title` and `text`; the text has at most 20 words.
- `stack`: tools, each `{ id, mark, label, icon? }`; `mark` is 1 to 3 characters. `icon` is a file under `public/stack/` (`/stack/name.svg` or `.png`); with none, the mark is shown.
- `longForm` and `shortForm`: videos, each `{ id, title, for, year, url, cover?, source }`. `source` is `youtube`, `instagram`, `vimeo` or `other`. `url` is https.
- `clients`: each `{ id, name, handle, avatar, url, socials: [{ type, url }] }`. A social `type` is `youtube`, `instagram`, `x` or `website`.
- `cover` and `avatar` are a path under `public/` (starting with `/`) or an https URL. A YouTube item may leave `cover` out: its link must then hold the 11-character video id, and the thumbnail is taken from it at runtime. Items of other sources with no cover get a seeded placeholder from picsum.photos.
- Ids must be unique within each list.
- The current entries are placeholders: 35 long form (`long-01` to `long-35`) and 35 short form (`short-01` to `short-35`), with made-up titles and years, and `for` set to "Placeholder". Their pictures come from picsum.photos at run time and are never stored.

## My experience page (`experience.json`)

- `frame`: the Mars picture's centre (longitude, latitude) and span in degrees; the same numbers as `public/mars/manifest.json` (a test compares them).
- `heading`: `title` and `text`. `moments`: each `{ id, date, label, title, struck?, line }`. `date` is `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (or `now` for the last one) and sets where the moment sits on the route; `label` is the date as shown. `struck` is the part of the title shown struck through. Dates ascend; ids are unique.
- `ui`: the words of the map's own controls: `journey`, `places` (the switch at the top right), `more`, `less` (the heading's button on phones). Every visible word on the page comes from this file.
- `caption`: the picture's caption (`title`, `line`, `credit`) and `factId`, the fact shown with it (its height and width).
- `route`: the route's points in order, `{ lon, lat }` (Mars longitude is east, 0 to 360), inside the frame. The first is outside the cliff, a later one inside it, and the last is no nearer the summit than 60% of the way from the cliff to the summit crater's rim (the schema checks this against `cliff` and `rim`).
- `cliff`: the Gazetteer's trace of Olympus Rupes as a closed ring of points, with its `source`. `rim`: the extent of Olympus Paterae (`north`, `south`, `east`, `west`, degrees) with its `source`.
- `places`: at most 8, each `{ id, name, lon, lat, line, sources, label?, cliffBearing? }`, inside the frame; `label` is `{ dx, dy }`, where the name sits in screen pixels from the feature (default: to its right), and `cliffBearing` (degrees clockwise from east, seen from the summit) puts the label on the cliff trace instead of at the feature's centre (Olympus Rupes is a line, and its Gazetteer centre is on the mountain); `facts`: each `{ id, text, source }`. Sources are https addresses of the USGS Gazetteer of Planetary Nomenclature or NASA. Nothing is written from memory.
- No em or en dash in any string.

## Publishing and sorting

- Navigation items render only when `visible: true`.
- Lists on the work page appear in the order they have in the file.

## Validation rules

- Ids must be unique
- External links must be valid URLs
- No em or en dashes in any copy
