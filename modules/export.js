import { errorDetails } from "./storage.js";

export function snapshotJSON(logger) {
  return JSON.stringify(logger.exportSnapshot(), null, 2);
}

export function snapshotCSV(logger) {
  const fields = ["seq", "wallTime", "monotonicMs", "sessionId", "pageInstanceId", "appVersion", "gitCommit", "module", "event", "visibilityState", "online", "payloadJson"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    fields.map(quote).join(","),
    ...logger.getEntries().map((entry) => fields.map((field) => quote(field === "payloadJson" ? JSON.stringify(entry.payload) : entry[field])).join(","))
  ].join("\r\n");
}

export function exportFilename(extension, date = new Date()) {
  const stamp = date.toISOString().replace(/\D/g, "").slice(0, 14);
  return `mrbd-probe-${stamp}.${extension}`;
}

export function triggerDownload(logger, content, type, extension) {
  const availability = { Blob: "Blob" in globalThis, createObjectURL: typeof URL.createObjectURL === "function" };
  logger.log("export", "download-attempt", { extension, apiAvailability: availability });
  try {
    if (!availability.Blob || !availability.createObjectURL) throw new Error("Blob download APIs missing");
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename(extension);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logger.log("export", "download-click-triggered", { filename: link.download, note: "Click triggered; file save is not confirmed" });
    return { ok: true, message: "Download click triggered; destination/save not confirmed." };
  } catch (error) {
    logger.log("export", "download-failed", { extension, ...errorDetails(error) });
    return { ok: false, message: `${error.name}: ${error.message}` };
  }
}

export async function copyText(logger, text, kind) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API missing");
    await navigator.clipboard.writeText(text);
    logger.log("export", "clipboard-write-complete", { kind, length: text.length });
    return { ok: true, message: `${kind} copied to clipboard.` };
  } catch (error) {
    logger.log("export", "clipboard-write-failed", { kind, ...errorDetails(error) });
    return { ok: false, message: `${error.name}: ${error.message}` };
  }
}

export async function shareJSON(logger, json) {
  try {
    if (typeof navigator.share !== "function") throw new Error("Web Share API missing");
    const file = typeof File === "function" ? new File([json], exportFilename("json"), { type: "application/json" }) : null;
    const fileShareable = file && (!navigator.canShare || navigator.canShare({ files: [file] }));
    const data = fileShareable ? { title: "MRBD Probe Log", files: [file] } : { title: "MRBD Probe Log", text: json.slice(0, 10000) };
    logger.log("export", "share-invoked", { fileShareable: Boolean(fileShareable) });
    await navigator.share(data);
    logger.log("export", "share-complete", { note: "Share promise resolved; destination not independently verified" });
    return { ok: true, message: "Share flow resolved; destination not independently verified." };
  } catch (error) {
    logger.log("export", "share-failed", errorDetails(error));
    return { ok: false, message: `${error.name}: ${error.message}` };
  }
}
