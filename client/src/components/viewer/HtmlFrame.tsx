"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Anchor } from "@/types";

const BRIDGE_SCRIPT = `
(function(){
  var commentAnchors = [];
  var pinnedNodes = [];
  var activeNode = null;
  var interactionMode = "browsing";

  function clearPinned(){
    for (var i = 0; i < pinnedNodes.length; i++) {
      var node = pinnedNodes[i];
      if (!node || !node.style) continue;
      node.style.outline = "";
      node.style.boxShadow = "";
    }
    pinnedNodes = [];
  }

  function clearActive(){
    if (!activeNode || !activeNode.style) return;
    activeNode.style.outline = "";
    activeNode.style.boxShadow = "";
    activeNode = null;
  }

  function simpleSelector(el){
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return "#" + CSS.escape(el.id);
    var path = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && depth < 6) {
      var sel = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === "string") {
        var c0 = cur.className.trim().split(/\\s+/)[0];
        if (c0) sel += "." + CSS.escape(c0);
      }
      var parent = cur.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function(x){ return x.tagName === cur.tagName; });
        if (same.length > 1) {
          var idx = Array.prototype.indexOf.call(same, cur) + 1;
          sel += ":nth-of-type(" + idx + ")";
        }
      }
      path.unshift(sel);
      cur = parent;
      depth++;
    }
    return path.join(" > ");
  }
  function getXPath(el){
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return '//*[@id="' + String(el.id).replace(/"/g, '') + '"]';
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && depth < 8) {
      var ix = 0;
      var sib = cur.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === cur.tagName) ix++;
        sib = sib.previousSibling;
      }
      parts.unshift(cur.tagName.toLowerCase() + "[" + (ix + 1) + "]");
      cur = cur.parentElement;
      depth++;
    }
    return "/" + parts.join("/");
  }
  function resolveAnchor(anchor){
    if (!anchor) return null;
    if (anchor.dataComment) {
      var sel = "[data-comment=\\"" + String(anchor.dataComment).replace(/\\\\/g, "\\\\\\\\").replace(/"/g, '\\\\"') + "\\"]";
      try { var q = document.querySelector(sel); if (q) return q; } catch(e) {}
    }
    if (anchor.selector) {
      try { var q2 = document.querySelector(anchor.selector); if (q2) return q2; } catch(e2) {}
    }
    return null;
  }
  function applyCommentAnchors(){
    clearPinned();
    if (interactionMode !== "commenting") return;
    var seen = new Set();
    for (var i = 0; i < commentAnchors.length; i++) {
      var node = resolveAnchor(commentAnchors[i]);
      if (!node || seen.has(node)) continue;
      seen.add(node);
      pinnedNodes.push(node);
      node.style.outline = "2px solid rgba(13,153,255,0.85)";
      node.style.boxShadow = "0 0 0 3px #fff, 0 0 0 6px rgba(13,153,255,0.28)";
    }
  }

  document.addEventListener("mouseover", function(e){
    if (interactionMode !== "commenting") return;
    var t = e.target;
    if (!t || !t.style) return;
    t.style.outline = "1px solid rgba(13,153,255,0.28)";
  });
  document.addEventListener("mouseout", function(e){
    if (interactionMode !== "commenting") return;
    var t = e.target;
    if (!t || !t.style) return;
    t.style.outline = "";
  });
  document.addEventListener("click", function(e){
    if (interactionMode !== "commenting") return;
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({
      type: "ELEMENT_SELECTED",
      anchor: {
        dataComment: el.dataset && el.dataset.comment ? el.dataset.comment : null,
        selector: simpleSelector(el),
        textContent: el.textContent ? el.textContent.trim().slice(0, 100) : null,
        tagName: el.tagName,
        xpath: getXPath(el)
      }
    }, "*");
  }, true);

  window.addEventListener("message", function(e){
    if (!e.data || typeof e.data !== "object") return;

    if (e.data.type === "SET_COMMENT_ANCHORS") {
      commentAnchors = Array.isArray(e.data.anchors) ? e.data.anchors : [];
      if (interactionMode === "commenting") applyCommentAnchors();
      else clearPinned();
      return;
    }
    if (e.data.type === "SET_INTERACTION_MODE") {
      interactionMode = e.data.mode === "commenting" ? "commenting" : "browsing";
      if (interactionMode !== "commenting") {
        document.body.style.cursor = "";
        clearPinned();
        clearActive();
      } else {
        applyCommentAnchors();
      }
      return;
    }
    if (e.data.type === "CHECK_ANCHOR_RESOLUTION") {
      var items = Array.isArray(e.data.items) ? e.data.items : [];
      var resolved = {};
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item || !item.id) continue;
        var anch = item.anchor;
        if (!anch || (!anch.selector && !anch.dataComment)) continue;
        resolved[item.id] = resolveAnchor(anch) !== null;
      }
      window.parent.postMessage({ type: "ANCHOR_RESOLUTION_RESULT", resolved: resolved }, "*");
      return;
    }
    if (e.data.type === "GET_ANCHOR_POSITIONS") {
      var comments = Array.isArray(e.data.comments) ? e.data.comments : [];
      var requestId = typeof e.data.requestId === "string" ? e.data.requestId : "default";
      var positions = {};
      var scrollW = document.documentElement.scrollWidth || document.body.scrollWidth || 1;
      var scrollH = document.documentElement.scrollHeight || document.body.scrollHeight || 1;
      for (var k = 0; k < comments.length; k++) {
        var c = comments[k];
        if (!c || !c.id) continue;
        var node = resolveAnchor(c.anchor);
        if (node) {
          var rect = node.getBoundingClientRect();
          positions[c.id] = {
            left: rect.left + window.scrollX,
            top: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            scrollWidth: scrollW,
            scrollHeight: scrollH
          };
        }
      }
      window.parent.postMessage({ type: "ANCHOR_POSITIONS", requestId: requestId, positions: positions }, "*");
      return;
    }
    if (e.data.type === "HIGHLIGHT_ELEMENT") {
      if (interactionMode !== "commenting") return;
      clearActive();
      var anchor = e.data.anchor;
      var node = resolveAnchor(anchor);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.style.outline = "2px solid #0066FF";
        node.style.boxShadow = "0 0 0 3px #fff, 0 0 0 6px rgba(0,102,255,0.38)";
        activeNode = node;
      }
      return;
    }
    if (e.data.type === "CLEAR_HIGHLIGHT") {
      clearActive();
      applyCommentAnchors();
      return;
    }
    if (e.data.type === "SET_CURSOR") {
      document.body.style.cursor = e.data.cursor || "";
      return;
    }
  });
})();
`;

function injectBridge(html: string): string {
  if (!html) return "";
  const script = "<script>" + BRIDGE_SCRIPT + "</script>";
  if (html.includes("</body>")) {
    return html.replace("</body>", script + "</body>");
  }
  return html + script;
}

export const HtmlFrame = forwardRef<
  HTMLIFrameElement,
  {
    html: string | null;
    loading: boolean;
    error: string | null;
    commentAnchors: Anchor[];
    interactionMode?: "browsing" | "commenting";
    anchorResolutionItems?: { id: string; anchor: Anchor }[];
    onAnchorResolution?: (resolved: Record<string, boolean>) => void;
    onFrameReady?: () => void;
  }
>(
  function HtmlFrame(
    {
      html,
      loading,
      error,
      commentAnchors,
      interactionMode = "browsing",
      anchorResolutionItems = [],
      onAnchorResolution,
      onFrameReady,
    },
    ref,
  ) {
  const localRef = useRef<HTMLIFrameElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  useImperativeHandle(ref, () => localRef.current as HTMLIFrameElement);
  const srcDoc = useMemo(() => (html ? injectBridge(html) : ""), [html]);

  useEffect(() => {
    setFrameReady(false);
  }, [srcDoc]);

  useEffect(() => {
    if (!frameReady) return;
    const win = localRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "SET_COMMENT_ANCHORS", anchors: commentAnchors }, "*");
  }, [commentAnchors, frameReady]);

  useEffect(() => {
    if (!frameReady) return;
    const win = localRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "SET_INTERACTION_MODE", mode: interactionMode }, "*");
  }, [interactionMode, frameReady]);

  useEffect(() => {
    if (!frameReady) return;
    const win = localRef.current?.contentWindow;
    if (!win) return;

    function onMsg(e: MessageEvent) {
      if (e.data?.type !== "ANCHOR_RESOLUTION_RESULT" || !e.data.resolved || typeof e.data.resolved !== "object") {
        return;
      }
      onAnchorResolution?.(e.data.resolved as Record<string, boolean>);
    }
    window.addEventListener("message", onMsg);

    if (!anchorResolutionItems.length) {
      onAnchorResolution?.({});
    } else {
      win.postMessage({ type: "CHECK_ANCHOR_RESOLUTION", items: anchorResolutionItems }, "*");
    }

    return () => window.removeEventListener("message", onMsg);
  }, [frameReady, anchorResolutionItems, onAnchorResolution]);

  function handleLoad() {
    setFrameReady(true);
    onFrameReady?.();
  }

  const artboardChrome = cn(
    "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5 dark:bg-card dark:ring-white/10",
  );

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={artboardChrome}>
          <Skeleton className="h-full min-h-[min(70dvh,520px)] w-full rounded-none" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={artboardChrome}>
          <div className="flex h-full min-h-[min(50dvh,320px)] items-center justify-center border-t border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }
  if (!srcDoc) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={artboardChrome}>
          <div className="flex h-full min-h-[min(50dvh,320px)] items-center justify-center border border-dashed border-border/80 text-sm text-muted-foreground">
            Select a file to preview
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={artboardChrome}>
        <iframe
          ref={localRef}
          title="HTML preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          className="block h-full min-h-[min(70dvh,520px)] w-full flex-1 border-0 bg-white"
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
});
