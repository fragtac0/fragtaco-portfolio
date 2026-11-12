/**
 * The gallery's one full-screen shader (vertex and fragment source).
 *
 * Ported from the ObsidianUI Art Gallery (vendor/obsidianui/art-gallery.jsx), Copyright (c) 2026
 * ObsidianUI, MIT License (vendor/obsidianui/LICENSE). Kept: one quad, a fragment shader that finds the
 * cell under each pixel and samples its picture from an atlas, a slight screen distortion. Changed
 * (spec 6.5): a finite grid laid out by `fitGrid` (columns, rows, a short last row centred) instead of
 * an endless repeating one; a 10 px gap and 8 px rounded corners (a signed distance box) instead of grid
 * lines and wide gutters; a barrel warp of 0.05 that pulls the layout in (the original pushed it out at
 * 0.08), inverted per pixel with Newton steps that gallery-math.ts's `unwarp` repeats exactly; the text
 * atlas is gone (the caption is DOM); no drag-to-zoom; hover growth of 4% for the tile under the
 * pointer; a slow drift and nudge offset; a visible ring on the focused tile; a tile whose picture has
 * not arrived (or never will) is flat `--surface-1`; no vignette fade; transparent between tiles so the
 * ground shows through.
 *
 * A per-tile state texture (count by 1, RGBA8) carries what changes per tile, so no uniform array is
 * needed: R the picture's reveal (0 flat surface, 1 the picture), G the hover amount, B the ring.
 */

import { CREAM, SURFACE_1, glslVec3 } from "../../../styles/tokens";
import { UNWARP_ITERATIONS } from "./gallery-math";

export const VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;          // canvas size, CSS px
uniform vec2 uOffset;       // drift plus nudge, layout px
uniform vec4 uGrid;         // cols, rows, count, gap
uniform vec4 uTile;         // tileW, tileH, originX, originY
uniform float uLastOff;     // the short last row's shift
uniform float uK;           // warp strength
uniform float uRadius;      // corner radius, px
uniform float uGrow;        // hover growth, 0.04
uniform vec4 uAtlas;        // atlas cols, cell width, cell height, unused
uniform vec2 uAtlasSize;    // atlas texture size, px
uniform sampler2D uPics;
uniform sampler2D uState;

const vec3 SURFACE = ${glslVec3(SURFACE_1)};
const vec3 RING = ${glslVec3(CREAM)};

float sdBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// screen px to layout px: the inverse of the barrel warp (radial, solved by Newton steps)
vec2 unwarp(vec2 p){
  vec2 s = (2.0 * p - uRes) / uRes;
  float sg = length(s);
  if (sg < 1e-5) return p;
  float r = sg;
  for (int i = 0; i < ${UNWARP_ITERATIONS}; i++) r -= (r - uK * r * r * r - sg) / (1.0 - 3.0 * uK * r * r);
  return ((s * (r / sg)) + 1.0) * 0.5 * uRes;
}

void main(){
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 c = unwarp(p) - uOffset - uTile.zw;
  float gap = uGrid.w;
  vec2 pitch = uTile.xy + gap;
  float row = floor((c.y + gap * 0.5) / pitch.y);
  float off = row > uGrid.y - 1.5 ? uLastOff : 0.0;
  float col = floor((c.x - off + gap * 0.5) / pitch.x);
  float idx = row * uGrid.x + col;
  if (row < 0.0 || row >= uGrid.y || col < 0.0 || col >= uGrid.x || idx >= uGrid.z) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec2 d = c - (vec2(col * pitch.x + off, row * pitch.y) + uTile.xy * 0.5);
  vec4 st = texture2D(uState, vec2((idx + 0.5) / uGrid.z, 0.5));
  // growth stays inside the tile's own cell (half a gap), so no neighbour has to look at it
  vec2 ext = min(uGrow * st.g * uTile.xy * 0.5, vec2(gap * 0.4));
  vec2 hs = uTile.xy * 0.5 + ext;
  float sd = sdBox(d, hs, uRadius);
  float a = 1.0 - smoothstep(-0.5, 0.5, sd);
  if (a <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec2 uv = d / (hs * 2.0) + 0.5;
  vec2 cell = vec2(mod(idx, uAtlas.x), floor(idx / uAtlas.x));
  vec2 cellPx = uAtlas.yz;
  vec2 pad = 0.5 / cellPx;
  vec2 px = (cell + clamp(uv, pad, 1.0 - pad)) * cellPx;
  vec3 col3 = mix(SURFACE, texture2D(uPics, px / uAtlasSize).rgb, st.r);
  float ring = st.b * smoothstep(-2.6, -2.0, sd) * (1.0 - smoothstep(-0.6, 0.0, sd));
  col3 = mix(col3, RING, ring);
  gl_FragColor = vec4(col3 * a, a);
}`;
