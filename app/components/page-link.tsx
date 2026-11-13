import { Link, useLocation, useNavigate, type LinkProps } from "@remix-run/react";
import { forwardRef, type MouseEvent } from "react";
import { changePage, type ChangeKind } from "../lib/page-change";
import { isOpenAddress } from "../utils/nav";

type PageLinkProps = Omit<LinkProps, "to" | "viewTransition"> & {
  to: string;
  /** How the page changes (default: the radial reveal). */
  kind?: ChangeKind;
};

/**
 * A link to another page that changes the page through `changePage` (the one owner of page changes),
 * growing from the centre of the control that was picked. It is still an ordinary `<a href>`: without
 * JavaScript, or with a modified click (new tab, new window), the browser follows the address. Other
 * pages' code and data are preloaded when the pointer, focus or a finger reaches it, as with Remix's own link.
 * A plain click on a link to the page that is already open does nothing: no navigation, no page change, and
 * focus stays where it is (spec 7). A modified click still follows the address, so it opens a new tab.
 */
const PageLink = forwardRef<HTMLAnchorElement, PageLinkProps>(function PageLink(
  { to, kind, prefetch = "intent", onClick, target, reloadDocument, ...rest },
  ref,
) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!plain || (target && target !== "_self") || reloadDocument || !to.startsWith("/")) return;
    event.preventDefault();
    if (isOpenAddress(to, pathname)) return;
    const box = event.currentTarget.getBoundingClientRect();
    void changePage(navigate, to, { kind, origin: { x: box.left + box.width / 2, y: box.top + box.height / 2 } });
  };

  return (
    <Link
      ref={ref}
      to={to}
      prefetch={prefetch}
      target={target}
      reloadDocument={reloadDocument}
      onClick={handleClick}
      {...rest}
    />
  );
});

export default PageLink;
