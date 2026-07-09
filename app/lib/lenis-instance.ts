import type Lenis from "lenis";

// Module-level singleton so plain utility functions (e.g. scrollWindowToSection,
// called from event handlers rather than render) can reach the active Lenis
// instance without threading it through React context/props everywhere.
let activeLenis: Lenis | null = null;

export function setActiveLenis(instance: Lenis | null) {
  activeLenis = instance;
}

export function getActiveLenis(): Lenis | null {
  return activeLenis;
}
