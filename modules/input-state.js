export const CORE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"];

export function createPairTracker(keys = CORE_KEYS) {
  const state = new Map(keys.map((key) => [key, { down: false, up: false, pending: false }]));
  return {
    observe(event) {
      const key = event.key;
      if (!state.has(key)) state.set(key, { down: false, up: false, pending: false });
      const item = state.get(key);
      if (event.type === "keydown") {
        item.down = true;
        item.pending = true;
      } else if (event.type === "keyup") {
        item.up = true;
        item.pending = false;
      }
      return { key, ...item };
    },
    get(key) {
      return state.has(key) ? { key, ...state.get(key) } : { key, down: false, up: false, pending: false };
    },
    summary() {
      return Array.from(state, ([key, value]) => ({ key, ...value }));
    }
  };
}
