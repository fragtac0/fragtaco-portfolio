/**
 * Props that take a subtree out of the tab order and the accessibility tree.
 *
 * `inert` is not in React 18's types, and React 18 only passes it through as a string attribute,
 * so it is spread as a string. React 19 reads `inert` as a boolean and would drop `""` as falsy:
 * when the project moves to 19, the one change is `inert: true` here (D-59).
 */
export function inertProps(on: boolean): Record<string, string> {
  return on ? { inert: "", "aria-hidden": "true" } : {};
}
