"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Anchor } from "@/types";

const BRIDGE_SCRIPT = `
(function(){
  var commentAnchors = [];
  var interactionMode = "browsing";

  function clearPinned(){}
  function clearActive(){}

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
    if (interactionMode !== "commenting") return;
  }

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
      return;
    }
    if (e.data.type === "SET_INTERACTION_MODE") {
      interactionMode = e.data.mode === "commenting" ? "commenting" : "browsing";
      if (interactionMode !== "commenting") {
        document.body.style.cursor = "";
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
      // Use iframe viewport dimensions as the coordinate space so the overlay
      // (which covers the same viewport) can map positions 1:1 without scaling.
      var viewW = window.innerWidth || document.documentElement.clientWidth || 1;
      var viewH = window.innerHeight || document.documentElement.clientHeight || 1;
      for (var k = 0; k < comments.length; k++) {
        var c = comments[k];
        if (!c || !c.id) continue;
        var node = resolveAnchor(c.anchor);
        if (node) {
          var rect = node.getBoundingClientRect();
          // Clamp to visible viewport; elements scrolled out of view are still
          // reported at their viewport-relative position (may be negative).
          positions[c.id] = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            scrollWidth: viewW,
            scrollHeight: viewH
          };
        }
      }
      window.parent.postMessage({ type: "ANCHOR_POSITIONS", requestId: requestId, positions: positions }, "*");
      return;
    }
    if (e.data.type === "MATCH_EXISTING_THREAD") {
      var requestId2 = typeof e.data.requestId === "string" ? e.data.requestId : "match-default";
      var selectedAnchor = e.data.selectedAnchor || null;
      var target = resolveAnchor(selectedAnchor);
      var topLevelComments = Array.isArray(e.data.comments) ? e.data.comments : [];
      var matchedCommentId = null;

      if (target) {
        for (var m = 0; m < topLevelComments.length; m++) {
          var item2 = topLevelComments[m];
          if (!item2 || !item2.id) continue;
          var node2 = resolveAnchor(item2.anchor);
          if (node2 && node2 === target) {
            matchedCommentId = item2.id;
            break;
          }
        }
      }

      window.parent.postMessage(
        { type: "MATCH_EXISTING_THREAD_RESULT", requestId: requestId2, commentId: matchedCommentId },
        "*",
      );
      return;
    }
    if (e.data.type === "HIGHLIGHT_ELEMENT") {
      if (interactionMode !== "commenting") return;
      var anchor = e.data.anchor;
      var node = resolveAnchor(anchor);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
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
