/**
 * The gallery's three.js scene, built once: the full-screen quad with the shader, its uniforms, and what the
 * engine does to them each frame. Split out of gallery-engine.ts (which owns the loop, input and the lifecycle).
 * Ported from the ObsidianUI Art Gallery (MIT, see vendor/obsidianui/LICENSE): an orthographic camera and a
 * ShaderMaterial on a 2 by 2 plane.
 */

import type * as THREE from "three";
import type { Atlas } from "./gallery-atlas";
import { HOVER_GROW, RADIUS_PX, type Grid } from "./gallery-math";
import { FRAGMENT, VERTEX } from "./gallery-shaders";
import { GROWN_SLOTS, type TileState } from "./gallery-state";
import { ARRIVAL } from "./wall-arrival";

export type GalleryScene = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  render(renderer: THREE.WebGLRenderer, offset: { x: number; y: number }): void;
  /** Links the shader now (without drawing), so the first frame of the arrival does not pay for it. */
  compile(renderer: THREE.WebGLRenderer): void;
  /** The canvas size and the grid changed. */
  applyGrid(grid: Grid, vw: number, vh: number): void;
};

export function createScene(T: typeof THREE, atlas: Atlas, state: TileState, vw: number, vh: number): GalleryScene {
  const L = atlas.layout;
  const A = atlas.artLayout;
  const uniforms = {
    uRes: { value: new T.Vector2(vw, vh) },
    uOffset: { value: new T.Vector2() },
    uGrid: { value: new T.Vector4() },
    uTile: { value: new T.Vector4() },
    uLastOff: { value: 0 },
    uRadius: { value: RADIUS_PX },
    uGrow: { value: HOVER_GROW },
    uGrown: { value: Array.from({ length: GROWN_SLOTS }, () => new T.Vector2(-1, 0)) },
    uAtlas: { value: new T.Vector4(L.cols, L.cellW, L.cellH, 0) },
    uAtlasSize: { value: new T.Vector2(L.width, L.height) },
    uArtAtlas: { value: new T.Vector4(A.cols, A.cellW, A.cellH, 0) },
    uArtSize: { value: new T.Vector2(A.width, A.height) },
    uScaleFrom: { value: ARRIVAL.scaleFrom },
    uPics: { value: atlas.texture },
    uArt: { value: atlas.artTexture },
    uState: { value: state.texture },
  };
  const geometry = new T.PlaneGeometry(2, 2);
  const material = new T.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  material.premultipliedAlpha = true;
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  return {
    geometry,
    material,
    applyGrid(grid, w, h) {
      uniforms.uRes.value.set(w, h);
      uniforms.uGrid.value.set(grid.cols, grid.rows, grid.count, grid.gap);
      uniforms.uTile.value.set(grid.tileW, grid.tileH, grid.originX, grid.originY);
      uniforms.uLastOff.value = grid.lastRowOffset;
    },
    compile(renderer) {
      renderer.compile(scene, camera);
    },
    render(renderer, offset) {
      uniforms.uOffset.value.set(offset.x, offset.y);
      for (let k = 0; k < GROWN_SLOTS; k++) {
        uniforms.uGrown.value[k].set(state.grown[k * 2], state.grown[k * 2 + 1]);
      }
      renderer.render(scene, camera);
    },
  };
}
