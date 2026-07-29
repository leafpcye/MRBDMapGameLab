export function getNavigationTarget({ key, index, count, orientation }) {
  if (index < 0 || count <= 0) return index;
  const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  if (key === previousKey) return Math.max(0, index - 1);
  if (key === nextKey) return Math.min(count - 1, index + 1);
  return index;
}
