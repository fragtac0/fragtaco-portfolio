import * as T from "three";
import { describe, expect, it } from "vitest";
import { LINE_ALPHA } from "../../../styles/tokens";
import { createAnimate, poseBooks, type PoseInput } from "./shelf-pose";
import { FRONT, OPEN_SECONDS, ROW_DIM } from "./shelf-math";
import { newBag, type Book, type ShelfScene } from "./shelf-scene";

/** Three books in a row (unit-ish sizes), with real three.js objects and the pieces the pose touches. */
function scene(): ShelfScene {
  const mk = (i: number): Book => {
    const W = 0.8;
    const H = 1.2;
    const t = 0.1;
    const mats = [0, 1, 2, 3, 4, 5].map(() => new T.MeshBasicMaterial({ transparent: true }));
    const litMats = [0, 1, 2, 3, 4, 5].map(() => new T.MeshStandardMaterial({ transparent: true }));
    const mesh = new T.Mesh(new T.BoxGeometry(W, H, t), mats);
    const g = new T.Group();
    g.add(mesh);
    const base = new T.Vector3(i * 0.3, H / 2, FRONT - W / 2);
    const baseQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2);
    const wallSh = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    );
    return {
      mesh,
      g,
      mats,
      litMats,
      wallSh,
      H,
      W,
      T: t,
      base,
      baseQ,
      openPos: new T.Vector3(i * 0.3, H / 2 + 0.3, FRONT + W / 2 + 0.12),
      openScale: 1,
      lift: 0.3,
      yMax: 5,
      anim: newBag(),
      order: i,
    } as unknown as Book;
  };
  const lightSet: number[] = [];
  const s = {
    books: [0, 1, 2].map(mk),
    tmpV: new T.Vector3(),
    tmpQ: new T.Quaternion(),
    tmpQ2: new T.Quaternion(),
    yAxis: new T.Vector3(0, 1, 0),
    qOpen: new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.3),
    line: new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true })),
    lights: {
      set(mix: number) {
        const changed = mix !== (lightSet.at(-1) ?? 0);
        lightSet.push(mix);
        return changed;
      },
    },
    setLit(b: Book, on: boolean) {
      b.mesh.material = on ? b.litMats : b.mats;
    },
  };
  return Object.assign(s, { lightSet }) as unknown as ShelfScene;
}

const lightSetOf = (s: ShelfScene) => (s as unknown as { lightSet: number[] }).lightSet;

const input = (s: ShelfScene, over: Partial<PoseInput> = {}): PoseInput => ({
  el: 99,
  dt: 1 / 60,
  now: 0,
  reduced: false,
  hover: null,
  focused: null,
  opened: null,
  animate: createAnimate(false),
  ...over,
});

/** Runs frames for `seconds` with book `idx` as the open one (or none). */
function run(s: ShelfScene, seconds: number, idx: number | null, over: Partial<PoseInput> = {}) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    poseBooks(s, input(s, { opened: idx === null ? null : s.books[idx], ...over }));
  }
}

describe("poseBooks: opening", () => {
  it("leaves the row alone while nothing is open: no lift, no shadow, full strength", () => {
    const s = scene();
    run(s, 0.2, null);
    for (const b of s.books) {
      expect(b.g.position.y).toBeCloseTo(b.base.y, 9);
      expect(b.g.position.z).toBeCloseTo(b.base.z, 9);
      expect(b.mesh.material).toBe(b.mats);
      expect(b.wallSh.visible).toBe(false);
    }
    expect(s.line.material.opacity).toBeCloseTo(LINE_ALPHA, 9);
  });

  it("rises straight up first: x stays, y grows, and it comes forward in depth", () => {
    const s = scene();
    const b = s.books[1];
    run(s, OPEN_SECONDS * 0.3, 1); // 30% of the way: only the rise is under way
    expect(b.g.position.x).toBeCloseTo(b.base.x, 9);
    expect(b.g.position.y).toBeGreaterThan(b.base.y + 0.02);
    expect(b.g.position.z).toBeGreaterThan(b.base.z);
    // not turned yet: still the spine to the viewer
    expect(b.g.quaternion.angleTo(b.baseQ)).toBeLessThan(1e-6);
  });

  it("turns to its cover after the rise, and is at its final place and size when the 620 ms are up", () => {
    const s = scene();
    const b = s.books[1];
    b.openScale = 0.8;
    run(s, OPEN_SECONDS + 0.05, 1);
    expect(b.g.position.distanceTo(b.openPos)).toBeLessThan(1e-9);
    expect(b.g.scale.x).toBeCloseTo(0.8, 9);
    // the sway is on: within 0.06 rad of the cover-first pose
    expect(b.g.quaternion.angleTo(s.qOpen)).toBeLessThan(0.07);
    expect(b.mesh.material).toBe(b.litMats);
  });

  it("never moves a neighbour", () => {
    const s = scene();
    run(s, 1 / 60, null);
    const before = s.books.map((b) => b.g.position.clone());
    run(s, 0.7, 1);
    for (const i of [0, 2]) {
      expect(s.books[i].g.position.distanceTo(before[i])).toBeLessThan(1e-12);
      expect(s.books[i].g.quaternion.angleTo(s.books[i].baseQ)).toBeLessThan(1e-9);
      expect(s.books[i].mesh.material).toBe(s.books[i].mats);
    }
  });

  it("dims the row to 70% and the book beside the others stays at full strength", () => {
    const s = scene();
    run(s, OPEN_SECONDS + 0.05, 1);
    for (const i of [0, 2]) expect(s.books[i].mats[0].opacity).toBeCloseTo(ROW_DIM, 9);
    expect(s.books[1].mats[0].opacity).toBe(1);
    expect(s.line.material.opacity).toBeCloseTo(LINE_ALPHA * ROW_DIM, 9);
  });

  it("lights the book as it rises: the light follows the lift from 0 to 1 and the wall shadow shows", () => {
    const s = scene();
    run(s, OPEN_SECONDS + 0.05, 1);
    const l = lightSetOf(s);
    expect(l[0]).toBeLessThan(0.05); // the first frame has hardly started
    expect(l[l.length - 1]).toBe(1);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1]);
    const sh = s.books[1].wallSh;
    expect(sh.visible).toBe(true);
    expect(sh.material.opacity).toBeCloseTo(0.5, 6);
    // a soft shadow as wide as the turned cover, lower and to the right of the book (light from the upper left)
    expect(sh.scale.x).toBeGreaterThan(0.8 / 0.53);
    expect(sh.position.x).toBeGreaterThan(s.books[1].g.position.x);
    expect(sh.position.y).toBeLessThan(s.books[1].g.position.y);
  });

  it("keeps the book's top inside the layer whatever else is added (hover) while it rises", () => {
    const s = scene();
    const b = s.books[1];
    b.yMax = b.base.y + 0.05;
    b.anim.hover = 1;
    run(s, 0.2, 1);
    expect(b.g.position.y).toBeLessThanOrEqual(b.base.y + 0.05 + 1e-9);
  });

  it("closing runs it backwards to the row, 620 ms, and the row comes back to full strength", () => {
    const s = scene();
    run(s, OPEN_SECONDS + 0.05, 1);
    run(s, OPEN_SECONDS + 0.05, null);
    for (const b of s.books) {
      expect(b.g.position.distanceTo(b.base)).toBeLessThan(1e-9);
      expect(b.mesh.material).toBe(b.mats);
      expect(b.mats[0].opacity).toBe(1);
    }
    expect(lightSetOf(s).at(-1)).toBe(0);
    expect(s.books[1].wallSh.visible).toBe(false);
  });

  it("is the same path both ways: the pose at a given progress is the same opening and closing", () => {
    const up = scene();
    run(up, 0.3, 1);
    const down = scene();
    run(down, OPEN_SECONDS + 0.1, 1);
    run(down, OPEN_SECONDS - 0.3, null);
    const a = up.books[1].anim.open;
    const b = down.books[1].anim.open;
    expect(Math.abs(a - b)).toBeLessThan(0.03);
    expect(up.books[1].g.position.distanceTo(down.books[1].g.position)).toBeLessThan(0.03);
  });

  it("is still while nothing is moving", () => {
    const s = scene();
    run(s, OPEN_SECONDS + 0.1, 1);
    expect(poseBooks(s, input(s, { opened: s.books[1], reduced: false, now: 0 }))).toBe(false);
  });
});

describe("poseBooks: reduced motion", () => {
  const reducedIn = (s: ShelfScene, idx: number | null) =>
    input(s, { reduced: true, animate: createAnimate(true), opened: idx === null ? null : s.books[idx] });

  it("puts the book at its lifted place at once and fades the cover in; nothing travels", () => {
    const s = scene();
    const b = s.books[1];
    poseBooks(s, reducedIn(s, 1));
    expect(b.g.position.distanceTo(b.openPos)).toBeLessThan(1e-9);
    expect(b.mats[0].opacity).toBeLessThan(0.2); // starts nearly clear
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      poseBooks(s, reducedIn(s, 1));
      seen.push(b.mats[0].opacity);
      expect(b.g.position.distanceTo(b.openPos)).toBeLessThan(1e-9); // the same place every frame
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[seen.length - 1]).toBeCloseTo(1, 2);
  });

  it("fades the book back into the row when it closes", () => {
    const s = scene();
    for (let i = 0; i < 60; i++) poseBooks(s, reducedIn(s, 1));
    poseBooks(s, reducedIn(s, null));
    const b = s.books[1];
    expect(b.g.position.distanceTo(b.base)).toBeLessThan(1e-9);
    expect(b.mats[0].opacity).toBeLessThan(0.2);
    for (let i = 0; i < 60; i++) poseBooks(s, reducedIn(s, null));
    expect(b.mats[0].opacity).toBeCloseTo(1, 2);
  });
});
