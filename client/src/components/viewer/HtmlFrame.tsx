"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Anchor } from "@/types";

const BRIDGE_SCRIPT = `
(function(){
  var commentAnchors = [];
  var commentPins = [];
  var pinnedNodes = [];
  var pinNodes = [];
  var activeNode = null;

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
  function clearPinNodes(){
    for (var i = 0; i < pinNodes.length; i++) {
      var pin = pinNodes[i];
      if (pin && pin.parentNode) pin.parentNode.removeChild(pin);
    }
    pinNodes = [];
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
    var seen = new Set();
    for (var i = 0; i < commentAnchors.length; i++) {
      var node = resolveAnchor(commentAnchors[i]);
      if (!node || seen.has(node)) continue;
      seen.add(node);
      pinnedNodes.push(node);
      node.style.outline = "2px solid rgba(249,115,22,0.95)";
      node.style.boxShadow = "0 0 0 3px #fff, 0 0 0 6px rgba(249,115,22,0.35)";
    }
  }
  function pinPositionTarget(el){
    if (!el || !el.getBoundingClientRect) return null;
    var rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY - 10,
      left: rect.left + window.scrollX - 10
    };
  }
  function drawPins(){
    clearPinNodes();
    for (var i = 0; i < commentPins.length; i++) {
      var row = commentPins[i];
      var node = resolveAnchor(row.anchor);
      if (!node) continue;
      var pos = pinPositionTarget(node);
      if (!pos) continue;
      var pin = document.createElement("button");
      pin.type = "button";
      pin.setAttribute("aria-label", "Open comment thread");
      pin.dataset.commentPin = "1";
      pin.dataset.commentId = String(row.commentId || "");
      pin.dataset.anchorKey = String(row.anchorKey || "");
      pin.style.position = "absolute";
      pin.style.top = pos.top + "px";
      pin.style.left = pos.left + "px";
      pin.style.width = "20px";
      pin.style.height = "20px";
      pin.style.borderRadius = "999px";
      pin.style.border = "none";
      pin.style.background = "#f97316";
      pin.style.color = "#fff";
      pin.style.font = "600 11px/20px ui-sans-serif, system-ui, sans-serif";
      pin.style.textAlign = "center";
      pin.style.cursor = "pointer";
      pin.style.zIndex = "2147483647";
      pin.style.boxShadow = "0 0 0 2px #fff, 0 0 0 5px rgba(249,115,22,0.32)";
      pin.textContent = String(row.count || 1);
      pin.addEventListener("click", function(evt){
        evt.preventDefault();
        evt.stopPropagation();
        var id = this && this.dataset ? this.dataset.commentId : "";
        var key = this && this.dataset ? this.dataset.anchorKey : "";
        window.parent.postMessage({ type: "PIN_SELECTED", commentId: id, anchorKey: key }, "*");
      }, true);
      pinNodes.push(pin);
      document.body.appendChild(pin);
    }
  }
  function refreshCommentOverlays(){
    applyCommentAnchors();
    drawPins();
  }
  document.addEventListener("mouseover", function(e){
    var t = e.target;
    if (!t || !t.style) return;
    t.style.outline = "2px solid rgba(99,102,241,0.35)";
  });
  document.addEventListener("mouseout", function(e){
    var t = e.target;
    if (!t || !t.style) return;
    t.style.outline = "";
  });
  document.addEventListener("click", function(e){
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el.dataset && el.dataset.commentPin === "1") return;
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
      refreshCommentOverlays();
      return;
    }
    if (e.data.type === "SET_COMMENT_PINS") {
      commentPins = Array.isArray(e.data.pins) ? e.data.pins : [];
      refreshCommentOverlays();
      return;
    }
    if (e.data.type === "HIGHLIGHT_ELEMENT") {
      clearActive();
      var anchor = e.data.anchor;
      var node = resolveAnchor(anchor);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.style.outline = "2px solid #6366F1";
        node.style.boxShadow = "0 0 0 3px #fff, 0 0 0 6px rgba(99,102,241,0.45)";
        activeNode = node;
      }
    }
    if (e.data.type === "CLEAR_HIGHLIGHT") {
      clearActive();
      refreshCommentOverlays();
    }
  });
  window.addEventListener("scroll", drawPins, true);
  window.addEventListener("resize", drawPins);
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
    commentPins: { commentId: string; anchor: Anchor; count: number; anchorKey: string }[];
  }
>(
  function HtmlFrame({ html, loading, error, commentAnchors, commentPins }, ref) {
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
    win.postMessage({ type: "SET_COMMENT_PINS", pins: commentPins }, "*");
  }, [commentPins, frameReady]);

  if (loading) {
    return <Skeleton className="h-full min-h-[400px] w-full rounded-lg" />;
  }
  if (error) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!srcDoc) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Select a file to preview
      </div>
    );
  }

  return (
    <iframe
      ref={localRef}
      title="HTML preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      className="h-full min-h-0 w-full flex-1 rounded-lg border border-border bg-white"
      onLoad={() => setFrameReady(true)}
    />
  );
});
