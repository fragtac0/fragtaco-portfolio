# Credits for third-party items (round 6)

One row per third-party item: what it is, where it came from, the licence or terms, and what was changed. Later round 6 tasks add rows (Mars tiles, the gallery port). Facts for Commons files are as the file's page states them on 11 November 2026.

## Code and packages

| What | Source | Licence or terms | What was changed |
| --- | --- | --- | --- |
| `shaders` 4.0.7, a WebGPU shader component library (npm dependency, pinned exactly) | https://www.npmjs.com/package/shaders, https://github.com/shader-effects-inc/shaders, docs at https://shaders.com | MIT, copyright Shader Effects Inc. (licence text in `node_modules/shaders/LICENSE`). Only the free components are used; its paid Pro library is not. | Nothing. Reached only through a dynamic import in the browser (Task 9). |
| ObsidianUI Art Gallery, `art-gallery.jsx`, and its helper `webgl-surface.jsx` (reference source for the video walls) | https://github.com/Atharvsinh-codez/ObsidianUI, files `src/components/block/art-gallery.jsx` and `src/lib/effects/shared/webgl-surface.jsx` at commit `a06708d431a29fd152f2575d4cca845d8507b918` (branch `main`, fetched from raw.githubusercontent.com) | MIT, "Copyright (c) 2026 ObsidianUI"; full text kept beside the files in `vendor/obsidianui/LICENSE` | Nothing: the two files are byte for byte as published, in `vendor/obsidianui/`. They import `@/` paths that do not exist here, so they are only a reference and are excluded from lint, typecheck and the build. The TypeScript port (Task 10) will carry the notice and list its changes in a row here. |

## Stack icons (`public/stack/`)

All eight are the apps' own product icons, taken from Wikimedia Commons, which carries each vendor's artwork as uploaded. The vendors' own brand pages were tried first: blender.org refused the request (HTTP 403); Figma's brand page offers only a zip download; Adobe and Apple have no press or brand page offering these app icons as files that could be found, so no vendor file was used for them. Commons states each icon as "Public domain" with the restriction "trademarked": the artwork is free to reproduce, the names and marks stay the property of their owners. They are used only to name the tool on the work page, not to suggest any endorsement.

| What (file) | Source (Commons file page) | Author and terms as Commons states them | What was changed |
| --- | --- | --- | --- |
| Adobe Premiere Pro icon (`premiere-pro.svg`) | https://commons.wikimedia.org/wiki/File:Adobe_Premiere_Pro_CC_2026_icon.svg | Adobe Inc.; Public domain; trademarked | Nothing (identical bytes) |
| Adobe After Effects icon (`after-effects.svg`) | https://commons.wikimedia.org/wiki/File:Adobe_After_Effects_CC_2026_icon.svg | Adobe Inc.; Public domain; trademarked | Nothing |
| Adobe Photoshop icon (`photoshop.svg`) | https://commons.wikimedia.org/wiki/File:Adobe_Photoshop_CC_2026_icon.svg | Adobe Inc.; Public domain; trademarked | Nothing |
| Adobe Illustrator icon (`illustrator.svg`) | https://commons.wikimedia.org/wiki/File:Adobe_Illustrator_CC_icon.svg (Adobe Illustrator CC icon, v30.0) | Adobe Inc.; Public domain; trademarked | Nothing |
| Adobe Lightroom icon (`lightroom.svg`) | https://commons.wikimedia.org/wiki/File:Adobe_Lightroom_CC_2026_icon.svg | Adobe Inc.; Public domain; trademarked | Nothing |
| Blender logo without text (`blender.svg`) | https://commons.wikimedia.org/wiki/File:Blender_logo_no_text.svg | Blender Foundation; Public domain; trademarked | Nothing |
| Figma logo (`figma.svg`) | https://commons.wikimedia.org/wiki/File:Figma-logo.svg | Figma; Public domain; trademarked | Nothing |
| Final Cut Pro icon (`final-cut-pro.png`, no vector exists on Commons) | https://commons.wikimedia.org/wiki/File:Final_Cut_Pro.png (1024 by 1024 PNG, dated 2025-09-09, uploaded by user ThienShang) | Author given as Apple; licence tag CC0 as set by the uploader. Commons also holds a newer 2026 icon (https://commons.wikimedia.org/wiki/File:FinalCutProACS2026.png, Public domain, trademarked) but only at 75 by 75 px, too small for 240 px. | Scaled from 1024 to 240 px (Lanczos), nothing else. The corners are square (the picture is full bleed); round them in CSS when it is shown. This may be the pre 2026 look of the icon; replace it if Aditya has the current one. |

No icon was drawn or edited by hand. The SVG files were checked and carry no editor metadata beyond the artwork's own `title`, `desc` and ids, which were left as published.
