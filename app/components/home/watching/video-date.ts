const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A video's publication day for the line under the chosen video: "12 Mar 2024". Takes the
 * `YYYY-MM-DD` start of a date or a full ISO time, reads the day as written (no time zone shifts
 * it), and returns an empty string when there is no real date, so the line simply leaves it out.
 */
export function formatPublished(published: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(published ?? "");
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return "";
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}
