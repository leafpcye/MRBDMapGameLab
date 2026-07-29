import { errorDetails } from "./storage.js";
import { getNavigationTarget } from "./navigation.js";
import { createPairTracker } from "./input-state.js";

const EVENT_TYPES = ["keydown", "keyup", "keypress", "focus", "blur", "focusin", "focusout", "click", "pointerdown", "pointerup"];
const APP_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"]);
const INPUT_MODES = new Set(["observe-only", "browser-default", "app-navigation"]);

export function createInputProbe({ logger, onUpdate }) {
  let active = false;
  let mode = "observe-only";
  let eventCount = 0;
  let recentEvents = [];
  const keyDownAt = new Map();
  const pairTracker = createPairTracker();

  function elementName(element) {
    if (!element) return "none";
    return element.dataset?.testControl || element.id || element.tagName?.toLowerCase() || "unknown";
  }

  function handler(event) {
    if (!active) return;
    const activeElementBefore = elementName(document.activeElement);
    const keyId = event.code || event.key;
    const testControl = event.target?.closest?.("[data-test-control]") || null;
    const shouldApplyNavigation = mode === "app-navigation"
      && event.type === "keydown"
      && APP_NAV_KEYS.has(event.key)
      && Boolean(testControl);
    const payload = {
      type: event.type,
      key: event.key ?? null,
      code: event.code ?? null,
      repeat: event.repeat ?? null,
      location: event.location ?? null,
      isComposing: event.isComposing ?? null,
      defaultPreventedBeforeProbe: event.defaultPrevented,
      timeStamp: event.timeStamp,
      activeElementBefore,
      activeElementAfter: activeElementBefore,
      testControl: testControl?.dataset?.testControl || null,
      inputMode: mode,
      preventDefaultRequested: shouldApplyNavigation,
      click: event.type === "click"
    };

    let pairState = null;
    let pairText = null;
    if (event.type === "keydown") {
      pairState = pairTracker.observe(event);
      if (!event.repeat) keyDownAt.set(keyId, event.timeStamp);
      pairText = `${event.key}: Waiting for keyup`;
    } else if (event.type === "keyup") {
      pairState = pairTracker.observe(event);
      if (keyDownAt.has(keyId)) {
        const durationMs = Math.max(0, event.timeStamp - keyDownAt.get(keyId));
        payload.matchedKeydown = true;
        payload.durationMs = Number(durationMs.toFixed(2));
        pairText = `${event.key}: matched · ${payload.durationMs} ms`;
        keyDownAt.delete(keyId);
      } else {
        payload.matchedKeydown = false;
        pairText = `${event.key}: No matching keydown observed`;
      }
    }

    // Log the raw event before application navigation changes focus or activates a control.
    const rawEntry = logger.log("input", event.type, payload);

    if (shouldApplyNavigation) {
      event.preventDefault();
      routeTestFocus(event);
      payload.activeElementAfter = elementName(document.activeElement);
      logger.log("input", "app-navigation-applied", {
        sourceSeq: rawEntry.seq,
        key: event.key,
        activeElementBefore,
        activeElementAfter: payload.activeElementAfter,
        defaultPrevented: event.defaultPrevented
      });
    } else {
      payload.activeElementAfter = elementName(document.activeElement);
    }

    eventCount += 1;
    const summary = {
      seq: rawEntry.seq,
      type: event.type,
      key: event.key ?? "—",
      code: event.code ?? "—",
      timestamp: Number(event.timeStamp?.toFixed?.(1) ?? event.timeStamp ?? 0),
      focus: payload.activeElementAfter,
      click: event.type === "click"
    };
    recentEvents = [...recentEvents, summary].slice(-8);
    onUpdate({
      eventCount,
      focus: payload.activeElementAfter,
      selection: elementName(event.target),
      ...(pairText ? { pairText } : {}),
      pairState,
      pairSummary: pairTracker.summary(),
      lastEvent: summary,
      recentEvents,
      mode
    });
  }

  // App Navigation is deliberately limited to probe controls and never wraps.
  // Escape is never intercepted, because MRBD system-menu behavior must remain observable.
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
    const orientation = group.classList.contains("horizontal") ? "horizontal" : "vertical";
    const currentIndex = controls.indexOf(current);
    const nextIndex = getNavigationTarget({ key: event.key, index: currentIndex, count: controls.length, orientation });
    if (nextIndex !== currentIndex) controls[nextIndex].focus({ preventScroll: false });
  }

  return {
    start() {
      if (active) return;
      try {
        EVENT_TYPES.forEach((type) => document.addEventListener(type, handler, true));
        active = true;
        logger.log("input", "probe-started", { eventTypes: EVENT_TYPES, mode });
        onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents });
      } catch (error) {
        logger.log("input", "probe-start-failed", errorDetails(error));
      }
    },
    stop() {
      EVENT_TYPES.forEach((type) => document.removeEventListener(type, handler, true));
      active = false;
      logger.log("input", "probe-stopped", { eventCount, unmatchedKeydowns: Array.from(keyDownAt.keys()), mode });
      onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents });
    },
    setMode(nextMode) {
      if (!INPUT_MODES.has(nextMode)) throw new TypeError(`Unknown input mode: ${nextMode}`);
      mode = nextMode;
      logger.log("input", "mode-changed", {
        mode,
        preventDefault: mode === "app-navigation",
        customFocusRouting: mode === "app-navigation",
        escapeIntercepted: false
      });
      onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents });
      return mode;
    },
    isActive: () => active
  };
}
