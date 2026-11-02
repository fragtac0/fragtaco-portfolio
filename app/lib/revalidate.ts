/**
 * True when a navigation changes nothing the loaders read: same path and same query string.
 * History moves that only change the hash (the home layer's /#reading and /#watching) must not
 * re-run the home loader.
 */
export function isHashOnlyMove(
  current: { pathname: string; search: string },
  next: { pathname: string; search: string },
): boolean {
  return current.pathname === next.pathname && current.search === next.search;
}
