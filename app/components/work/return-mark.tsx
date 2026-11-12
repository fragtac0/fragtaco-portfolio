import PageLink from "../page-link";

/**
 * The way back from a wall to the rings (top right): three small arcs that turn slowly, and the label
 * "rings". A link to `/work` that grows from itself (radial). Spec 6.5.
 */
export default function ReturnMark() {
  return (
    <PageLink to="/work" kind="radial" aria-label="Back to the rings" className="return-mark" data-wall-top="">
      <svg className="return-mark-arcs" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        {/* one circle drawn as three arcs of 70 degrees with 50 degree gaps */}
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" pathLength="360" strokeDasharray="70 50" />
      </svg>
      <span aria-hidden="true">rings</span>
    </PageLink>
  );
}
