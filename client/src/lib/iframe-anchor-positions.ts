import type { Anchor } from "@/types";

export type PinPositionRaw = {
  cx: number;
  cy: number;
  scrollWidth: number;
  scrollHeight: number;
};

/** Mirrors HtmlFrame bridge `resolveAnchor` so parent can measure without postMessage latency. */
export function resolveAnchorInDocument(doc: Document, anchor: Anchor): Element | null {
  if (!anchor) return null;
  if (anchor.dataComment) {
    const escaped = String(anchor.dataComment).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const sel = `[data-comment="${escaped}"]`;
    try {
      const q = doc.querySelector(sel);
      if (q) return q;
    } catch {
      /* invalid selector */
    }
  }
  if (anchor.selector) {
    try {
      const q2 = doc.querySelector(anchor.selector);
      if (q2) return q2;
    } catch {
      /* invalid selector */
    }
  }
  return null;
}

/**
 * Measures anchor centers in iframe viewport space (same as GET_ANCHOR_POSITIONS in the bridge).
 * Returns null when the iframe document is not readable (e.g. cross-origin).
 */
export function measureAnchorsInIframe(
  iframe: HTMLIFrameElement,
  items: { id: string; anchor: Anchor }[],
): { pins: Record<string, PinPositionRaw>; ghost: PinPositionRaw | null } | null {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return null;

  const viewW = win.innerWidth || doc.documentElement.clientWidth || 1;
  const viewH = win.innerHeight || doc.documentElement.clientHeight || 1;

  const pins: Record<string, PinPositionRaw> = {};
  let ghost: PinPositionRaw | null = null;

  for (const item of items) {
    const node = resolveAnchorInDocument(doc, item.anchor);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    // Skip elements with no layout box — display:none on element or ancestor
    // (common in SPAs where inactive pages stay in DOM but are hidden).
    if (rect.width === 0 && rect.height === 0) continue;
    const raw: PinPositionRaw = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      scrollWidth: viewW,
      scrollHeight: viewH,
    };
    if (item.id === "__ghost__") {
      ghost = raw;
    } else {
      pins[item.id] = raw;
    }
  }

  return { pins, ghost };
}
