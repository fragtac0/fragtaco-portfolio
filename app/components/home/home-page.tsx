import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  SiteBook,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteSocialLink,
  SiteVideo,
} from "../../types";
import SiteNav from "../site-nav";
import InterestBlocks, { BLOCK_ID } from "./blocks/interest-blocks";
import HeroCards from "./cards/hero-cards";
import { heroNav, type NavContext, type NavInput, type NavState } from "./cards/hero-nav";
import Hero, { type HeroHandle } from "./hero/hero";
import InterestLayer from "./layer/interest-layer";
import {
  LayerControlContext,
  type LayerControl,
  type LayerSceneHooks,
} from "./layer/layer-context";
import {
  escTarget,
  layerFromHash,
  layerReducer,
  type LayerAction,
  type LayerKind,
  type LayerState,
} from "./layer/layer-state";

type HomePageProps = {
  home: SiteHomeContent;
  heroPaintings: SiteHeroPainting[];
  books: SiteBook[];
  videos: SiteVideo[];
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
};

/** Each dispatch carries the context it was made in, so the reducer stays pure. */
type NavAction = { input: NavInput; ctx: NavContext };
const navReducer = (state: NavState, { input, ctx }: NavAction): NavState =>
  heroNav(state, input, ctx);

export default function HomePage({
  home,
  heroPaintings,
  books,
  videos,
  navigationItems,
  socialLinks,
}: HomePageProps) {
  const heroRef = useRef<HeroHandle>(null);
  const [nav, dispatchNav] = useReducer(navReducer, "hidden");
  // The gesture gate: the cards hook keeps heroVisible current; a later task sets layerOpen.
  const navCtx = useRef<NavContext>({ heroVisible: true, layerOpen: false });
  const dispatch = useCallback(
    (input: NavInput) => dispatchNav({ input, ctx: { ...navCtx.current } }),
    [],
  );
  // The dock rises with the cards, the first time the hero leaves "hidden".
  const [revealed, setRevealed] = useState(false);
  if (!revealed && nav !== "hidden") setRevealed(true);

  // "the cut": scroll to the top first when needed, wait for it, then toggle the intro card.
  const aboutTimer = useRef<number | null>(null);
  const onAbout = useCallback(() => {
    if (aboutTimer.current !== null) window.clearTimeout(aboutTimer.current);
    const toggle = () => {
      aboutTimer.current = null;
      dispatch({ kind: "toggle", side: "right" });
    };
    if (window.scrollY > 10) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      aboutTimer.current = window.setTimeout(toggle, 520);
    } else {
      toggle();
    }
  }, [dispatch]);
  useEffect(
    () => () => {
      if (aboutTimer.current !== null) window.clearTimeout(aboutTimer.current);
    },
    [],
  );

  // ---- the reading / watching layer (grows out of a block, see layer/)
  const [layer, rawDispatchLayer] = useReducer(layerReducer, {
    kind: null,
    phase: "closed",
  } as LayerState);
  // The phase ref is advanced right where the reducer is dispatched (the reducer is pure, so it
  // computes the same state React will), never in a passive effect: openLayer and closeLayer can
  // run twice before a render and must see the phase the first call left.
  const layerRef = useRef<LayerState>(layer);
  const dispatchLayer = useCallback((action: LayerAction) => {
    layerRef.current = layerReducer(layerRef.current, action);
    rawDispatchLayer(action);
  }, []);
  // True while the layer owns a history entry it pushed (not a deep link): closing then goes Back.
  const pushedRef = useRef(false);
  const [layerFrom, setLayerFrom] = useState<HTMLElement | null>(null);
  const sceneHooks = useRef<LayerSceneHooks>({});
  const layerLive = layer.phase === "growing" || layer.phase === "open";

  const openLayer = useCallback<LayerControl["openLayer"]>(
    (kind, from, opts) => {
      if (layerRef.current.phase !== "closed") return;
      setLayerFrom(from);
      navCtx.current.layerOpen = true;
      if (opts?.push !== false) {
        // Remix keeps its bookkeeping (key, idx) in history.state: keep it, and add ours
        const prev = (window.history.state ?? {}) as { idx?: number };
        window.history.pushState(
          { ...prev, xp: kind, idx: (prev.idx ?? 0) + 1 },
          "",
          "#" + kind,
        );
        pushedRef.current = true;
      } else {
        pushedRef.current = false;
      }
      dispatchLayer({ type: "open", kind });
    },
    [dispatchLayer],
  );
  const closeLayer = useCallback(() => {
    const phase = layerRef.current.phase;
    if (phase !== "growing" && phase !== "open") return;
    dispatchLayer({ type: "close" });
    if (pushedRef.current) {
      // leave the entry the layer pushed; the popstate that follows finds the layer already shrinking
      pushedRef.current = false;
      window.history.back();
    } else {
      // a deep link owns no entry of its own: just drop the hash
      window.history.replaceState(window.history.state, "", "/");
    }
  }, [dispatchLayer]);
  const registerSceneHooks = useCallback((hooks: LayerSceneHooks) => {
    sceneHooks.current = hooks;
    return () => {
      if (sceneHooks.current === hooks) sceneHooks.current = {};
    };
  }, []);
  const layerControl = useMemo<LayerControl>(
    () => ({ openLayer, closeLayer, registerSceneHooks }),
    [openLayer, closeLayer, registerSceneHooks],
  );

  // A deep link (/#reading, /#watching on arrival, or a history move onto one) opens the layer
  // from its block, with no history entry of its own. The block is scrolled into view first,
  // instantly, so the grow starts from where the block is.
  const openFromHash = useCallback(
    (kind: LayerKind) => {
      const block = document.getElementById(BLOCK_ID[kind]);
      if (!block) return;
      block.scrollIntoView({ block: "center", behavior: "instant" });
      openLayer(kind, block, { push: false });
    },
    [openLayer],
  );

  // What a block's words and previews warm up: the scenes hook their prepare() here later.
  const onBlockNear = useCallback(() => {}, []);

  const onHeroReady = useCallback(() => {
    dispatch({ kind: "show" });
    // Arriving at /#about (a reload, or "the cut" from /work): open the intro card, then drop
    // the hash so it does not linger. Remix keeps its bookkeeping in history.state: keep it.
    if (window.location.hash === "#about") {
      dispatch({ kind: "go", to: "right" });
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
    // Arriving at /#reading or /#watching: open that layer from its block.
    const kind = layerFromHash(window.location.hash);
    if (kind) openFromHash(kind);
  }, [dispatch, openFromHash]);

  // While the layer is not closed: the cards ignore gestures, the hero's paint loop parks, the
  // page is locked (html.locked, separate from intro and cards-open), and the dock is hidden.
  const layerActive = layer.phase !== "closed";
  useEffect(() => {
    if (!layerActive) return;
    const html = document.documentElement;
    const ctx = navCtx.current;
    const hero = heroRef.current;
    ctx.layerOpen = true;
    hero?.setParked("layer", true);
    html.classList.add("locked");
    return () => {
      ctx.layerOpen = false;
      hero?.setParked("layer", false);
      html.classList.remove("locked");
    };
  }, [layerActive]);

  // History moves. While the layer is live, any of them closes it (the reducer ignores a close
  // while it is already shrinking); the entry it pushed is gone either way. With the layer closed,
  // a move onto /#reading or /#watching (Forward) opens it.
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      if (layerRef.current.phase !== "closed") {
        dispatchLayer({ type: "close" });
        return;
      }
      const kind = layerFromHash(window.location.hash);
      if (kind) openFromHash(kind);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dispatchLayer, openFromHash]);

  // Esc closes an open video, then an open book, then the layer.
  useEffect(() => {
    if (!layerLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const h = sceneHooks.current;
      const target = escTarget({
        bookOpen: h.isBookOpen?.() ?? false,
        videoOpen: h.isVideoOpen?.() ?? false,
        layer: layerRef.current,
      });
      if (target === null) return;
      e.preventDefault();
      if (target === "video") h.closeVideo?.();
      else if (target === "book") h.closeBook?.();
      else closeLayer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layerLive, closeLayer]);

  const layerTitle: Record<LayerKind, string> = {
    reading: "What I'm reading",
    watching: "What I'm watching",
  };
  const layerMeta: Record<LayerKind, string> = {
    reading: `${books.length} books this year`,
    watching: `${videos.length} videos`,
  };

  const open = nav === "left" || nav === "right";
  useEffect(() => {
    heroRef.current?.setBlur(open ? 1 : 0);
    heroRef.current?.setParked("card", open);
  }, [open]);

  return (
    <LayerControlContext.Provider value={layerControl}>
      <main className="home-page bg-ink text-fog">
        <Hero
          ref={heroRef}
          name={home.hero.name}
          roles={home.hero.roles}
          paintings={heroPaintings}
          softened={open}
          onReady={onHeroReady}
        >
          <HeroCards
            about={home.about}
            credits={home.credits}
            nav={nav}
            dispatch={dispatch}
            hero={heroRef}
            navCtx={navCtx}
          />
        </Hero>
        <InterestBlocks
          books={books}
          videos={videos}
          onOpen={openLayer}
          onNear={onBlockNear}
        />
        <SiteNav
          items={navigationItems}
          socialLinks={socialLinks}
          home={{
            revealed,
            hidden: layerActive,
            aboutOpen: nav === "right",
            onAbout,
          }}
        />
        {layer.kind !== null && layerActive && (
          <InterestLayer
            state={layer}
            from={layerFrom}
            title={layerTitle[layer.kind]}
            meta={layerMeta[layer.kind]}
            onClose={closeLayer}
            onGrown={() => dispatchLayer({ type: "grown" })}
            onShrunk={() => dispatchLayer({ type: "shrunk" })}
          >
            {/* the shelf and the wall arrive in later tasks */}
            {({ kind }) => <div className="layer-placeholder" data-kind={kind} />}
          </InterestLayer>
        )}
      </main>
    </LayerControlContext.Provider>
  );
}
