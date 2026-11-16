import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { getHomePageContent } from "../../content/loaders.server";
import SiteNav from "../site-nav";
import { boxPicture } from "./blocks/box-picture";
import InterestBlocks from "./blocks/interest-blocks";
import HeroCards from "./cards/hero-cards";
import { heroNav, type NavContext, type NavInput, type NavState } from "./cards/hero-nav";
import Hero, { type HeroHandle } from "./hero/hero";
import InterestLayer from "./layer/interest-layer";
import { LayerControlContext } from "./layer/layer-context";
import { countLabel } from "../../utils/count-label";
import { layerFromHash, type LayerKind } from "./layer/layer-state";
import { useLayerHistory } from "./layer/use-layer-history";
import ReadingScene from "./reading/reading-scene";
import { useBoxScenes } from "./use-box-scenes";
import { useSceneEngines } from "./use-scene-engines";
import { wallOrder } from "./watching/wall-block";
import WatchingScene from "./watching/watching-scene";

const noSubscription = () => () => {};

/** What the home route's loader sends, which is exactly what the page takes. */
type HomePageProps = Awaited<ReturnType<typeof getHomePageContent>>;

const LAYER_TITLE: Record<LayerKind, string> = {
  reading: "What I'm reading",
  watching: "What I'm watching",
};

/** Each dispatch carries the context it was made in, so the reducer stays pure. */
type NavAction = { input: NavInput; ctx: NavContext };
const navReducer = (state: NavState, { input, ctx }: NavAction): NavState =>
  heroNav(state, input, ctx);

export default function HomePage({
  home,
  heroPaintings,
  firstPaintingId,
  books,
  videos: playlist,
  navigationItems,
  socialLinks,
}: HomePageProps) {
  // the playlist, shuffled once with a fixed seed: the wall, its plain grid and the block's preview all
  // show this order, so it is the same on every visit and on the server
  const videos = useMemo(() => wallOrder(playlist), [playlist]);
  const heroRef = useRef<HeroHandle>(null);
  const [nav, dispatchNav] = useReducer(navReducer, "hidden");
  // The gesture gate: the cards hook keeps heroVisible current; a later task sets layerOpen.
  const navCtx = useRef<NavContext>({ heroVisible: true, layerOpen: false });
  const dispatch = useCallback(
    (input: NavInput) => dispatchNav({ input, ctx: { ...navCtx.current } }),
    [],
  );
  const setLayerOpen = useCallback((open: boolean) => {
    navCtx.current.layerOpen = open;
  }, []);
  // The dock rises with the cards, the first time the hero leaves "hidden".
  const [revealed, setRevealed] = useState(false);
  if (!revealed && nav !== "hidden") setRevealed(true);

  // ---- the reading / watching layer (grows out of a block, see layer/)
  const {
    layer,
    layerFrom,
    layerInstant,
    layerActive,
    layerControl,
    headerHidden,
    openLayer,
    closeLayer,
    dispatchLayer,
    openFromHash,
    closeDetail,
  } = useLayerHistory({ heroRef, setLayerOpen });

  // The dock's home tab: close a card, close a layer (the same path Esc takes, so the URL hash and
  // history stay right), then scroll to the top. A closing layer shrinks back to its block, so
  // the scroll waits until the layer is gone rather than moving the page under it. The dock is
  // down while a layer is active, so this is mostly the card case; the layer branch keeps the tab
  // correct if it is ever reached.
  const scrollAfterLayer = useRef(false);
  const scrollToTop = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, []);
  const onHome = useCallback(() => {
    dispatch({ kind: "go", to: "hero" });
    if (layerActive) {
      closeLayer();
      scrollAfterLayer.current = true;
    } else {
      scrollToTop();
    }
  }, [dispatch, layerActive, closeLayer, scrollToTop]);
  useEffect(() => {
    if (layerActive || !scrollAfterLayer.current) return;
    scrollAfterLayer.current = false;
    scrollToTop();
  }, [layerActive, scrollToTop]);

  // The shelf and wall engines, and what a block coming near warms up in them.
  const { shelf, wall, wallPicks, onBlockNear } = useSceneEngines(books, videos);
  // the scenes live in their home boxes all the time (spec 6.1) and the layer carries them out and back (layer/move-driver.ts)
  const engines = useMemo(() => ({ reading: shelf, watching: wall }), [shelf, wall]);
  const boxes = useBoxScenes(layer, engines, openLayer);
  const { onDrawn, onPlain } = boxes;
  const onDrawnReading = useCallback(() => onDrawn("reading"), [onDrawn]);
  const onPlainReading = useCallback(() => onPlain("reading"), [onPlain]);
  const onDrawnWatching = useCallback(() => onDrawn("watching"), [onDrawn]);
  const onPlainWatching = useCallback(() => onPlain("watching"), [onPlain]);
  // false on the server and in the hydration render, true after (the scenes and the live boxes are client only)
  const clientReady = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  // what each box shows: the ground until the client has decided, then its live scene, or the flat preview once the scene has gone plain
  // (box-picture.ts); a live visitor never mounts the flat previews, so it requests none of their thumbnails
  const picture = useMemo(
    () => ({
      reading: boxPicture(clientReady, boxes.status.reading),
      watching: boxPicture(clientReady, boxes.status.watching),
    }),
    [clientReady, boxes.status.reading, boxes.status.watching],
  );
  // the home page behind a layer sinks and dims while it opens (layer/move-driver.ts writes its transform)
  const sinkRef = useRef<HTMLDivElement>(null);
  const layerOpen = layer.phase !== "closed";
  const settledKind = layer.phase === "open" ? layer.kind : null;
  const onReopen = useCallback(() => {
    if (layer.kind && layerFrom) openLayer(layer.kind, layerFrom);
  }, [layer.kind, layerFrom, openLayer]);

  const onHeroReady = useCallback(() => {
    dispatch({ kind: "show" });
    // Arriving at /#about (a reload, or an old link): open the intro card, then drop
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
    if (kind) openFromHash(kind, true);
  }, [dispatch, openFromHash]);

  const layerMeta: Record<LayerKind, string> = {
    reading: `${countLabel(books.length, "book", "books")} this year`,
    watching: countLabel(videos.length, "video", "videos"),
  };

  const open = nav === "left" || nav === "right";
  useEffect(() => {
    heroRef.current?.setBlur(open ? 1 : 0);
    heroRef.current?.setParked("card", open);
  }, [open]);

  return (
    <LayerControlContext.Provider value={layerControl}>
      <main className="home-page bg-ink text-fog">
        <div ref={sinkRef} className="home-sink">
          <Hero
            ref={heroRef}
            name={home.hero.name}
            roles={home.hero.roles}
            paintings={heroPaintings}
            firstPaintingId={firstPaintingId}
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
            onOpen={boxes.onOpen}
            homes={boxes.homes}
            picture={picture}
            onNear={onBlockNear}
            blocked={open}
            covered={layerActive}
          />
        </div>
        <SiteNav
          items={navigationItems}
          socialLinks={socialLinks}
          home={{
            revealed,
            hidden: layerActive,
            onHome,
          }}
        />
        {layer.kind !== null && layerActive && boxes.homes && (
          <InterestLayer
            state={layer}
            from={layerFrom}
            instant={layerInstant}
            title={LAYER_TITLE[layer.kind]}
            meta={layerMeta[layer.kind]}
            headerHidden={headerHidden}
            scene={boxes.homes[layer.kind]}
            engine={
              boxes.status[layer.kind] === "plain" || boxes.gaveUp[layer.kind]
                ? null
                : layer.kind === "reading"
                ? shelf
                : wall
            }
            sinkRef={sinkRef}
            closeDetail={closeDetail}
            onClose={closeLayer}
            onReopen={onReopen}
            onGrown={() => dispatchLayer({ type: "grown" })}
            onShrunk={() => dispatchLayer({ type: "shrunk" })}
          />
        )}
        {clientReady && boxes.homes
          ? createPortal(
              <ReadingScene
                engine={shelf}
                books={books}
                run={boxes.run.reading}
                open={layerOpen && layer.kind === "reading"}
                settled={settledKind === "reading"}
                onDrawn={onDrawnReading}
                onPlain={onPlainReading}
                gaveUp={boxes.gaveUp.reading}
              />,
              boxes.homes.reading,
            )
          : null}
        {clientReady && boxes.homes
          ? createPortal(
              <WatchingScene
                engine={wall}
                videos={videos}
                picks={wallPicks}
                run={boxes.run.watching}
                open={layerOpen && layer.kind === "watching"}
                onDrawn={onDrawnWatching}
                onPlain={onPlainWatching}
                gaveUp={boxes.gaveUp.watching}
              />,
              boxes.homes.watching,
            )
          : null}
      </main>
    </LayerControlContext.Provider>
  );
}
