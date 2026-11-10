/** "1 book", "14 books": the count with its noun in the right number. */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
