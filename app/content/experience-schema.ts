import { z } from "zod";
import { extentRadius, frameOf, insideFrame, meanRadius, pointInRing, fractionDistance } from "../components/experience/geo";
import { routeStopRadius } from "../components/experience/route";

// My experience page (content/site/experience.json, spec 9.6): the words, the route, the places and the
// facts of the Mars map. Every place is inside the frame, every fact and place names its source, the route
// starts outside the cliff, crosses it and stops short of the summit, and no string has an em or en dash.

const LonLatSchema = z.object({ lon: z.number().min(0).max(360), lat: z.number().min(-90).max(90) });
const SourceSchema = z.string().url().startsWith("https://");
const text = z.string().min(1);

const hasUniqueIds = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
const uniqueIds = { message: "Ids must be unique within the list" };

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (a real month and day), or `now`. */
const MomentDateSchema = z.string().refine((value) => {
  if (value === "now") return true;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2] ?? 1), Number(match[3] ?? 1)];
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Expected YYYY, YYYY-MM, YYYY-MM-DD or now");

/** A sortable day for a moment's date (ISO strings with the missing month and day filled in). */
const sortKey = (date: string) => {
  if (date === "now") return "9999-99-99";

  return date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date;
};

const MomentSchema = z.object({
  id: text,
  date: MomentDateSchema,
  label: text,
  title: text,
  struck: text.optional(),
  line: text,
});

const PlaceSchema = z.object({
  id: text,
  name: text,
  lon: LonLatSchema.shape.lon,
  lat: LonLatSchema.shape.lat,
  line: text,
  sources: z.array(SourceSchema).min(1),
});

const FactSchema = z.object({ id: text, text, source: SourceSchema });

const dashPattern = /[\u2013\u2014]/;

function collectDashes(value: unknown, path: (string | number)[], found: (string | number)[][]) {
  if (typeof value === "string") {
    if (dashPattern.test(value)) found.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectDashes(item, [...path, i], found));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectDashes(item, [...path, key], found));
  }
}

export const ExperienceSchema = z
  .object({
    frame: z.object({ centre: LonLatSchema, spanDeg: z.number().positive() }),
    heading: z.object({ title: text, text }),
    moments: z.array(MomentSchema).min(2).refine(hasUniqueIds, uniqueIds),
    caption: z.object({ title: text, line: text, factId: text, credit: text }),
    route: z.array(LonLatSchema).min(2),
    cliff: z.object({ source: SourceSchema, points: z.array(LonLatSchema).min(3) }),
    rim: z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number(), source: SourceSchema }),
    places: z.array(PlaceSchema).max(8).refine(hasUniqueIds, uniqueIds),
    facts: z.array(FactSchema).min(1).refine(hasUniqueIds, uniqueIds),
  })
  .superRefine((page, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const frame = frameOf(page.frame.centre, page.frame.spanDeg);

    // Words.
    page.moments.forEach((moment, i) => {
      if (moment.struck !== undefined && !moment.title.includes(moment.struck)) {
        issue(["moments", i, "struck"], "The struck part must be in the title");
      }
      if (moment.date === "now" && i !== page.moments.length - 1) {
        issue(["moments", i, "date"], "Only the last moment can be now");
      }
      if (i > 0 && sortKey(moment.date) < sortKey(page.moments[i - 1].date)) {
        issue(["moments", i, "date"], "Moments must be in ascending date order");
      }
    });
    if (!page.facts.some((fact) => fact.id === page.caption.factId)) {
      issue(["caption", "factId"], "The caption's fact must be one of the facts");
    }

    // Inside the frame.
    page.places.forEach((place, i) => {
      if (!insideFrame(place.lon, place.lat, frame)) issue(["places", i], "A place must be inside the frame");
    });
    page.route.forEach((point, i) => {
      if (!insideFrame(point.lon, point.lat, frame)) issue(["route", i], "A route point must be inside the frame");
    });
    page.cliff.points.forEach((point, i) => {
      if (!insideFrame(point.lon, point.lat, frame)) issue(["cliff", "points", i], "A cliff point must be inside the frame");
    });
    if (page.rim.north <= page.rim.south || page.rim.east <= page.rim.west) {
      issue(["rim"], "The rim's extent must run south to north and west to east");
    }

    // The route: starts on the plain, crosses the cliff, stops short of the summit (spec 9.3).
    const [first, ...rest] = page.route;
    const last = page.route[page.route.length - 1];

    if (pointInRing(first, page.cliff.points, frame)) issue(["route", 0], "The route must start outside the cliff");
    if (!rest.some((point) => pointInRing(point, page.cliff.points, frame))) {
      issue(["route"], "The route must cross the cliff");
    }

    const limit = routeStopRadius(meanRadius(page.cliff.points, frame), extentRadius(page.rim, frame));

    if (fractionDistance(last, frame.centre, frame) < limit) {
      issue(["route", page.route.length - 1], "The route must stop at 60% of the way from the cliff to the rim at most");
    }

    // No em or en dash anywhere.
    const dashes: (string | number)[][] = [];

    collectDashes(page, [], dashes);
    dashes.forEach((path) => issue(path, "No em or en dash"));
  });
