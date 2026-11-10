# Changes, November 2026 polish pass

One row per audit finding fixed. Ids refer to `docs/redesign/audit-2026-11-11.md`.

| Id | What changed | Where | Commit |
| --- | --- | --- | --- |
| K-01, K-09 | `home.css` (1,614 lines) split into one stylesheet per area (hero, cards, blocks, layer, reading, watching), each imported by the component that owns it. New `tokens.css` holds the shared values (type scale, ink steps, `--z-*` scale, section space) and the home page's old custom properties. The page-level z-index values of the cards (20) and the layer (300) now use `--z-cards` and `--z-layer`; local stacking values stay literal. No visual change. | `app/styles/tokens.css`, `app/components/home/{hero,cards,blocks,layer,reading,watching}/*.css`, `app/root.tsx` | R31.1 |
