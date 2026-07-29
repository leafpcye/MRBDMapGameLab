export function getNavigationTarget({ key, index, count, orientation }) {
  if (index < 0 || count <= 0) return index;
  const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  if (key === previousKey) return Math.max(0, index - 1);
  if (key === nextKey) return Math.min(count - 1, index + 1);
  return index;
}

export function getDirectionalNeighbor({ key, currentIndex, rects }) {
  if (currentIndex < 0 || currentIndex >= rects.length) return currentIndex;
  const direction = {
    ArrowUp: { axis: "y", sign: -1 },
    ArrowDown: { axis: "y", sign: 1 },
    ArrowLeft: { axis: "x", sign: -1 },
    ArrowRight: { axis: "x", sign: 1 }
  }[key];
  if (!direction) return currentIndex;

  const centers = rects.map((rect) => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }));
  const current = centers[currentIndex];
  let bestIndex = currentIndex;
  let bestScore = Number.POSITIVE_INFINITY;

  centers.forEach((candidate, index) => {
    if (index === currentIndex) return;
    const primaryDelta = direction.axis === "x"
      ? (candidate.x - current.x) * direction.sign
      : (candidate.y - current.y) * direction.sign;
    if (primaryDelta <= 1) return;
    const crossDelta = direction.axis === "x"
      ? Math.abs(candidate.y - current.y)
      : Math.abs(candidate.x - current.x);
    const score = primaryDelta + crossDelta * 2;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}
