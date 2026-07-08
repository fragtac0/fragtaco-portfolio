export const layout = {
  pageContainer:
    "mx-auto min-h-screen w-full max-w-[1520px] px-4 py-6 pb-[calc(var(--site-nav-height)+2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-12 lg:py-12",
  homeContainer:
    "mx-auto min-h-screen-nav w-full max-w-[1520px] px-4 py-6 pb-[calc(var(--site-nav-height)+2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-12 lg:py-12",
};

export const textStyles = {
  headerMeta:
    "grid gap-2 font-mono text-[0.56rem] uppercase tracking-[0.18em] text-fog/48 sm:grid-cols-3 sm:items-start sm:gap-3 sm:text-[0.62rem] sm:tracking-[0.28em]",
  sectionKicker:
    "motion-safe:animate-cut-reveal font-mono text-[0.64rem] uppercase tracking-[0.16em] text-fog/48 sm:text-[0.74rem] sm:tracking-[0.24em]",
  displayTitle:
    "mt-5 motion-safe:animate-cut-reveal font-doto text-[clamp(3.8rem,19vw,17rem)] font-black uppercase leading-[0.76] tracking-section text-fog [animation-delay:90ms] sm:text-[clamp(5.2rem,19vw,17rem)]",
  displayTitleStandalone:
    "motion-safe:animate-cut-reveal font-doto text-[clamp(3.8rem,19vw,17rem)] font-black uppercase leading-[0.76] tracking-section text-fog [animation-delay:90ms] sm:text-[clamp(5.2rem,19vw,17rem)]",
  panelTitle:
    "font-doto text-[1.9rem] font-black uppercase leading-none tracking-section text-fog sm:text-[3rem]",
  shelfTitle:
    "font-doto text-[2rem] font-black uppercase leading-none tracking-section text-fog sm:text-[3.2rem]",
  shelfLabel:
    "font-mono text-[0.56rem] uppercase tracking-[0.2em] text-fog/42 sm:text-[0.6rem] sm:tracking-[0.28em]",
  accentLabel:
    "font-mono text-[0.58rem] uppercase tracking-[0.2em] text-accent sm:text-[0.62rem] sm:tracking-[0.28em]",
  giltLabel:
    "font-mono text-[0.58rem] uppercase tracking-[0.2em] text-gilt sm:text-[0.62rem] sm:tracking-[0.28em]",
  heroTitle:
    "font-doto text-[2.5rem] leading-[0.94] font-black uppercase tracking-normal text-fog drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-[4.25rem] md:text-[5.5rem] lg:text-[7rem]",
  heroSubtitle:
    "mt-4 font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-fog/85 sm:mt-5 sm:text-[15px] sm:tracking-[0.3em] md:text-[17px]",
  factHeadline:
    "font-doto text-[1.35rem] font-black uppercase leading-[1.05] text-fog sm:text-[1.8rem]",
  factBody:
    "font-serif text-[1rem] leading-[1.8] text-fog/85 sm:text-[1.1rem]",
  chipLabel:
    "font-mono text-[0.62rem] uppercase tracking-[0.3em] text-fog/70 sm:text-[0.72rem]",
};

export const surfaces = {
  aboutHeader:
    "relative isolate overflow-hidden rounded-[2.75rem_1.25rem_2.75rem_1.25rem] bg-white/[0.06] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.44),0_0_74px_rgba(252,76,0,0.13),inset_0_1px_0_rgba(255,236,214,0.13)] ring-1 ring-white/12 backdrop-blur-2xl motion-safe:animate-glass-breathe sm:p-7 lg:rounded-[3.25rem_1.5rem_3.25rem_1.5rem] lg:p-10",
  workHeader:
    "relative isolate overflow-hidden rounded-[1.25rem_2.75rem_1.25rem_2.75rem] bg-theme-black/36 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32),0_0_70px_rgba(252,76,0,0.18),inset_0_1px_0_rgba(255,236,214,0.13)] ring-1 ring-white/12 backdrop-blur-2xl motion-safe:animate-glass-breathe motion-safe:[animation-delay:-1.1s] motion-safe:[animation-duration:12.5s] sm:p-7 lg:rounded-[1.5rem_3.25rem_1.5rem_3.25rem] lg:p-10",
  aboutFooterCard:
    "relative isolate min-w-0 overflow-hidden rounded-[2.25rem_1rem_2.25rem_1rem] bg-white/[0.06] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,236,214,0.09)] ring-1 ring-white/10 motion-safe:animate-glass-breathe [contain:paint] sm:p-6",
  factCard:
    "relative isolate w-full min-h-[16rem] min-w-0 overflow-hidden rounded-[2.25rem_1rem_2.25rem_1rem] bg-white/[0.06] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,236,214,0.09)] ring-1 ring-white/10 motion-safe:animate-glass-breathe [contain:paint] sm:p-8",
  glassChip:
    "inline-flex items-center gap-3 rounded-full bg-black/38 px-4 py-2 ring-1 ring-white/14 backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.35)]",
  workPanel:
    "relative isolate overflow-hidden rounded-[1rem_2.25rem_1rem_2.25rem] bg-theme-black/34 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28),0_0_52px_rgba(252,76,0,0.12),inset_0_1px_0_rgba(255,236,214,0.11)] ring-1 ring-white/10 backdrop-blur-2xl motion-safe:animate-glass-breathe sm:p-6",
  reachPanel:
    "relative isolate overflow-hidden rounded-[2.75rem_1.25rem_2.75rem_1.25rem] bg-theme-black/32 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.32),0_0_74px_rgba(252,76,0,0.16),inset_0_1px_0_rgba(255,236,214,0.13)] ring-1 ring-white/12 backdrop-blur-2xl motion-safe:animate-glass-breathe sm:p-7",
  reachOutPanel:
    "relative isolate overflow-hidden rounded-[1.25rem_2.75rem_1.25rem_2.75rem] bg-theme-black/34 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.32),0_0_74px_rgba(252,76,0,0.16),inset_0_1px_0_rgba(255,236,214,0.13)] ring-1 ring-white/12 backdrop-blur-2xl motion-safe:animate-glass-breathe motion-safe:[animation-delay:-4.9s] motion-safe:[animation-duration:13.8s] sm:p-7 lg:p-9",
};

export const effects = {
  glassSheen:
    "pointer-events-none absolute inset-y-0 -z-10 w-1/2 motion-safe:animate-glass-sheen",
};

export const aboutProfileTags = [
  "mumbai",
  "cuts",
  "motion",
  "colour",
  "sound",
  "side-quests",
];

export function staggerDelay(index: number, base: number, step: number) {
  return `${base + index * step}ms`;
}

export function styleUnlessReduced<T extends object>(
  reducedMotion: boolean | null,
  style: T,
) {
  return reducedMotion ? undefined : style;
}
