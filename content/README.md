# Content Guide

This portfolio uses git-backed content files so routine updates do not require React or route changes. Invalid content fails when it is loaded and in the tests (`app/content/schemas.ts`).

## Directory layout

- `content/site/home.json`: hero copy, about card and credits card
- `content/site/books.json`: the books on the shelf
- `content/site/videos.json`: the videos on the wall (written by `yarn sync:videos`, do not edit by hand)
- `content/site/hero-paintings.json`: the hero paintings
- `content/site/work.json`: the work page (intro, tools, long and short videos, clients)
- `content/site/timeline.json`: the timeline page (start date, roles, marked days)
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

## Timeline page (`timeline.json`)

- `start`: the first day, `YYYY-MM-DD` (a real date).
- `roles`: each `{ id, label, from, color }`, in strictly ascending `from` order; the first `from` equals `start`; a role runs until the next one starts. `color` is `#rrggbb`. Ids are unique.
- `marks`: marked days, each `{ date, label }`, not before `start`. Empty for now.
- The last square is the day the page is requested (the server's UTC date), so nothing here needs updating daily.

## Publishing and sorting

- Navigation items render only when `visible: true`.
- Lists on the work page appear in the order they have in the file.

## Validation rules

- Ids must be unique
- External links must be valid URLs
- No em or en dashes in any copy
