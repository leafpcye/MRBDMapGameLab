import { errorDetails } from "./storage.js";

const EVENT_TYPES = ["keydown", "keyup", "keypress", "focus", "blur", "focusin", "focusout", "click", "pointerdown", "pointerup"];
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"]);

export function createInputProbe({ logger, root, onUpdate }) {
  let active = false;
  let preventNavigation = false;
  let eventCount = 0;
  const keyDownAt = new Map();

  function elementName(element) {
    if (!element) return "none";
    return element.dataset?.testControl || element.id || element.tagName?.toLowerCase() || "unknown";
  }

  function handler(event) {
    if (!active) return;
    const beforeFocus = elementName(document.activeElement);
    let preventedByProbe = false;
    if (preventNavigation && event.type === "keydown" && NAV_KEYS.has(event.key)) {
      event.preventDefault();
      preventedByProbe = true;
      routeTestFocus(event);
    }
    const targetName = elementName(event.target);
    const payload = {
      type: event.type,
      key: event.key ?? null,
      code: event.code ?? null,
      repeat: event.repeat ?? null,
      location: event.location ?? null,
      isComposing: event.isComposing ?? null,
      defaultPrevented: event.defaultPrevented,
      timeStamp: event.timeStamp,
      activeElementBefore: beforeFocus,
      activeElementAfter: elementName(document.activeElement),
      testControl: event.target?.dataset?.testControl || null,
      preventedByProbe
    };
    eventCount += 1;
    let pairText = "No matching keyup observed";
    if (event.type === "keydown" && !event.repeat) keyDownAt.set(event.code || event.key, event.timeStamp);
    if (event.type === "keyup") {
      const keyId = event.code || event.key;
      if (keyDownAt.has(keyId)) {
        const durationMs = Math.max(0, event.timeStamp - keyDownAt.get(keyId));
        payload.matchedKeydown = true;
        payload.durationMs = Number(durationMs.toFixed(2));
        pairText = `${event.key}: ${payload.durationMs} ms`;
        keyDownAt.delete(keyId);
      } else {
        payload.matchedKeydown = false;
      }
    }
    logger.log("input", event.type, payload);
    onUpdate({ eventCount, focus: elementName(document.activeElement), selection: targetName, pairText });
  }

  // This routing is deliberately limited to the probe controls and never wraps.
  // It gives MRBD direction events an observable focus effect without replacing
  // the browser's focus model when the explicit prevent-default switch is off.
  function routeTestFocus(event) {
    const current = event.target.closest?.("[data-test-control]");
    if (!current) return;
    if (event.key === "Enter") {
      queueMicrotask(() => current.click());
      return;
    }
    const group = current.closest("fieldset");
    if (!group) return;
    const controls = Array.from(group.querySelectorAll("[data-test-control]"));
    const index = controls.indexOf(current);
    const horizontal = group.classList.contains("horizontal");
    const backward = event.key === (horizontal ? "ArrowLeft" : "ArrowUp");
    const forward = event.key === (horizontal ? "ArrowRight" : "ArrowDown");
    if (!backward && !forward) return;
    const next = index + (backward ? -1 : 1);
    if (next >= 0 && next < controls.length) controls[next].focus({ preventScroll: false });
  }

  return {
    start() {
      if (active) return;
      try {
        EVENT_TYPES.forEach((type) => document.addEventListener(type, handler, true));
        active = true;
        logger.log("input", "probe-started", { eventTypes: EVENT_TYPES });
        onUpdate({ active, eventCount });
      } catch (error) {
        logger.log("input", "probe-start-failed", errorDetails(error));
      }
    },
    stop() {
      EVENT_TYPES.forEach((type) => document.removeEventListener(type, handler, true));
      active = false;
      logger.log("input", "probe-stopped", { eventCount, unmatchedKeydowns: Array.from(keyDownAt.keys()) });
      onUpdate({ active, eventCount });
    },
    setPreventNavigation(value) {
      preventNavigation = Boolean(value);
      logger.log("input", "prevent-default-changed", { enabled: preventNavigation, keys: Array.from(NAV_KEYS) });
      return preventNavigation;
    },
    isActive: () => active
  };
}
