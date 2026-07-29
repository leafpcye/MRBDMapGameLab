import { errorDetails } from "./storage.js";
import { getNavigationTarget } from "./navigation.js";
import { boundedRecentEvents, createPairTracker, formatElementDescriptor, formatInputValue } from "./input-state.js";

const EVENT_TYPES = ["keydown", "keyup", "keypress", "focus", "blur", "focusin", "focusout", "click", "pointerdown", "pointerup"];
const APP_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"]);
const INPUT_MODES = new Set(["observe-only", "browser-default", "app-navigation"]);
const KEYBOARD_EVENT_TYPES = new Set(["keydown", "keyup", "keypress"]);
export const RECENT_RAW_EVENT_LIMIT = 4;

export function describeElement(element) {
  if (!element) return "none";
  return formatElementDescriptor({
    tagName: element.tagName || element.nodeName || "unknown",
    id: element.id || "",
    testId: element.dataset?.testid || element.dataset?.testId || "",
    functionName: element.dataset?.testControl || "",
    text: element.textContent || ""
  });
}

export function createInputProbe({ logger, onUpdate }) {
  let active = false;
  let mode = "observe-only";
  let eventCount = 0;
  let recentEvents = [];
  const pairTracker = createPairTracker();

  function handler(event) {
    if (!active) return;
    const activeElementBefore = describeElement(document.activeElement);
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
    if (KEYBOARD_EVENT_TYPES.has(event.type)) {
      pairState = pairTracker.observe(event);
    }
    if (event.type === "keydown") {
      pairText = `${event.key}: Waiting for keyup`;
    } else if (event.type === "keyup") {
      if (pairState.matched) {
        payload.matchedKeydown = true;
        payload.durationMs = pairState.latestDurationMs;
        pairText = `${event.key}: matched · ${payload.durationMs} ms`;
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
      payload.activeElementAfter = describeElement(document.activeElement);
      logger.log("input", "app-navigation-applied", {
        sourceSeq: rawEntry.seq,
        key: event.key,
        activeElementBefore,
        activeElementAfter: payload.activeElementAfter,
        defaultPrevented: event.defaultPrevented
      });
    } else {
      payload.activeElementAfter = describeElement(document.activeElement);
    }

    eventCount += 1;
    let keyboardSummary = null;
    if (KEYBOARD_EVENT_TYPES.has(event.type)) {
      keyboardSummary = {
        seq: rawEntry.seq,
        type: event.type,
        key: formatInputValue(event.key),
        code: formatInputValue(event.code),
        timestamp: Number(event.timeStamp?.toFixed?.(1) ?? event.timeStamp ?? 0),
        focus: activeElementBefore,
        click: false
      };
      recentEvents = boundedRecentEvents(recentEvents, keyboardSummary, RECENT_RAW_EVENT_LIMIT);
    }
    const metrics = pairTracker.metrics();
    onUpdate({
      eventCount,
      focus: payload.activeElementAfter,
      selection: describeElement(event.target),
      ...(pairText ? { pairText } : {}),
      pairState,
      pairSummary: pairTracker.summary(),
      ...(event.type === "keydown" ? { lastKeydown: keyboardSummary } : {}),
      ...(event.type === "keyup" ? { lastKeyup: keyboardSummary } : {}),
      recentEvents,
      metrics,
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
    if (nextIndex !== currentIndex) {
      controls[nextIndex].focus({ preventScroll: false });
      return;
    }

    const exitsVerticalBoundary = orientation === "vertical"
      && ((event.key === "ArrowDown" && currentIndex === controls.length - 1)
        || (event.key === "ArrowUp" && currentIndex === 0));
    const traversesHorizontalGroup = orientation === "horizontal"
      && (event.key === "ArrowUp" || event.key === "ArrowDown");
    if (!exitsVerticalBoundary && !traversesHorizontalGroup) return;

    const groups = Array.from(document.querySelectorAll("#input-controls fieldset"));
    const groupIndex = groups.indexOf(group);
    const groupDelta = event.key === "ArrowUp" ? -1 : 1;
    const targetGroup = groups[groupIndex + groupDelta];
    const targetControls = Array.from(targetGroup?.querySelectorAll?.("[data-test-control]") || []);
    const target = event.key === "ArrowUp" ? targetControls[targetControls.length - 1] : targetControls[0];
    target?.focus({ preventScroll: false });
  }

  return {
    start() {
      if (active) return;
      try {
        EVENT_TYPES.forEach((type) => document.addEventListener(type, handler, true));
        active = true;
        logger.log("input", "probe-started", { eventTypes: EVENT_TYPES, mode });
        onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents, metrics: pairTracker.metrics() });
      } catch (error) {
        logger.log("input", "probe-start-failed", errorDetails(error));
      }
    },
    stop() {
      EVENT_TYPES.forEach((type) => document.removeEventListener(type, handler, true));
      active = false;
      logger.log("input", "probe-stopped", { eventCount, ...pairTracker.metrics(), mode });
      onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents, metrics: pairTracker.metrics() });
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
      onUpdate({ active, eventCount, mode, pairSummary: pairTracker.summary(), recentEvents, metrics: pairTracker.metrics() });
      return mode;
    },
    isActive: () => active
  };
}
