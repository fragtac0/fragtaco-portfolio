import type { ReachStat } from "../types";
import { PAGE_VIEW_BASELINE, getPageViewTotal } from "./page-views.server";

const STATIC_REACH_STATS: ReachStat[] = [
  {
    href: "https://www.youtube.com/@fragtaco",
    id: "x",
    label: "views delivered",
    metricLabel: "Across client edits",
    tooltip: "Combined lifetime views on videos I edited for clients and channels.",
    numericValue: 40_000_000,
    value: "40M+",
    live: false,
  },
  {
    href: "https://www.instagram.com/fragtaco/",
    id: "instagram",
    label: "projects cut",
    metricLabel: "Edits shipped",
    tooltip: "Brand films, music videos, montages, and motion packs delivered since 2019.",
    numericValue: 300,
    value: "300+",
    live: false,
  },
  {
    id: "visits",
    label: "screening room",
    metricLabel: "Portfolio visits",
    tooltip: "Visits carried over from my previous portfolio plus live traffic here.",
    numericValue: PAGE_VIEW_BASELINE,
    value: "25K+",
    live: false,
  },
];

function formatCompactCount(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value)}+`;
}

export async function getReachStats() {
  const pageViews = await getPageViewTotal();

  return STATIC_REACH_STATS.map((stat) => {
    if (stat.id !== "visits") {
      return stat;
    }

    return {
      ...stat,
      live: pageViews.live,
      tooltip: "Visits carried over from my previous portfolio plus live traffic here.",
      numericValue: pageViews.total,
      value: formatCompactCount(pageViews.total),
    };
  });
}
