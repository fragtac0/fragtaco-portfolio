/** "1 book", "14 books", "1,065 days": the count (with thousands separators) and its noun in the right number. */
export function countLabel(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
