import { useId, useState } from "react";
import PageLink from "../page-link";
import { countLabel } from "../../utils/count-label";
import { formatMonthYear, type RoleSummary } from "./timeline-model";

interface TimelineLegendProps {
  start: string;
  total: number;
  roles: RoleSummary[];
}

/**
 * The label block at the top left (the poster's yellow block): the title, the date range, the number of
 * days and the way back to the work page, with the roles and their day counts under it. On phones the
 * block is one row and the roles open from a "roles" button.
 */
export default function TimelineLegend({ start, total, roles }: TimelineLegendProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <aside className="tl-legend" aria-label="Timeline key">
      <div className="tl-block">
        <h1 className="tl-title">Timeline</h1>
        <p className="tl-meta">
          <span>{formatMonthYear(start)} - today</span>
          <span>{countLabel(total, "day", "days")}</span>
        </p>
        <div className="tl-actions">
          <PageLink to="/work" className="tl-back" aria-label="Back to work">
            <span aria-hidden="true">&larr;</span> work
          </PageLink>
          <button
            type="button"
            className="tl-roles-toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            roles
          </button>
        </div>
      </div>
      <ul id={listId} className="tl-roles" data-open={open}>
        {roles.map((role) => (
          <li key={role.id} className="tl-role">
            <span className="tl-chip" style={{ background: role.color }} aria-hidden="true" />
            <span className="tl-role-name">{role.label}</span>
            <span className="tl-role-days">{countLabel(role.days, "day", "days")}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
