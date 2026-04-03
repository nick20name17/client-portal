
import { createPortal } from "react-dom";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { cn } from "@/lib/utils";

export interface MentionMember {
  id: string;
  name: string;
  image: string | null;
}

// ── DOM helpers ────────────────────────────────────────────────────────────────

function makeMentionSpan(name: string, id: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.setAttribute("contenteditable", "false");
  span.dataset.mentionId = id;
  span.dataset.mentionName = name;
  span.textContent = `@${name}`;
  // Classes applied via [&_.mention] on the parent
  span.className = "mention";
  return span;
}

/** Parse stored "@[Name](id)" value into DOM nodes and append to `parent`. */
function populateFromValue(parent: HTMLElement, value: string) {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (match.index > last) {
      parent.appendChild(document.createTextNode(value.slice(last, match.index)));
    }
    parent.appendChild(makeMentionSpan(match[1], match[2]));
    last = match.index + match[0].length;
  }
  if (last < value.length) {
    parent.appendChild(document.createTextNode(value.slice(last)));
  }
}

/** Walk the contenteditable tree and produce the stored "@[Name](id)" format. */
function serialize(el: HTMLElement): string {
  let out = "";
  function walk(node: ChildNode) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Strip zero-width spaces used as cursor anchors
      out += (node.textContent ?? "").replace(/\u200B/g, "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement;
      if (e.dataset.mentionId) {
        out += `@[${e.dataset.mentionName}](${e.dataset.mentionId})`;
      } else if (e.tagName === "BR") {
        out += "\n";
      } else if (e.tagName === "DIV" || e.tagName === "P") {
        // Chrome wraps new lines in <div>
        if (out.length > 0 && !out.endsWith("\n")) out += "\n";
        Array.from(e.childNodes).forEach(walk);
      } else {
        Array.from(e.childNodes).forEach(walk);
      }
    }
  }
  Array.from(el.childNodes).forEach(walk);
  return out;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DropdownState {
  items: MentionMember[];
  activeIdx: number;
  top: number;
  left: number;
  width: number;
}

interface MentionPendingState {
  atIndex: number;
  textNode: Text;
  query: string;
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  members?: MentionMember[];
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MentionTextarea = forwardRef<HTMLDivElement, Props>(
  function MentionTextarea(
    { value, onValueChange, members = [], rows = 3, placeholder, disabled, className, autoFocus, onKeyDown, onBlur },
    outerRef,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(outerRef, () => editorRef.current!);

    // Tracks last value emitted so we don't re-render the DOM for our own changes
    const lastValueRef = useRef(value);
    // Pending mention state — stored outside React state to avoid stale closures
    const pendingRef = useRef<MentionPendingState | null>(null);
    const [dd, setDd] = useState<DropdownState | null>(null);
    const [hasContent, setHasContent] = useState(!!value);

    // ── Init on mount ────────────────────────────────────────────────────────
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = "";
      if (value) populateFromValue(el, value);
      lastValueRef.current = value;
      setHasContent(!!value);
      if (autoFocus) {
        el.focus();
        // Place cursor at end
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Respond to external value resets (e.g. submit → value = "") ──────────
    useEffect(() => {
      const el = editorRef.current;
      if (!el || value === lastValueRef.current) return;
      el.innerHTML = "";
      if (value) populateFromValue(el, value);
      lastValueRef.current = value;
      setHasContent(!!value);
    }, [value]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function emitChange() {
      const el = editorRef.current;
      if (!el) return;
      const serialized = serialize(el);
      lastValueRef.current = serialized;
      setHasContent(serialized.length > 0);
      onValueChange(serialized);
    }

    function detectMention() {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || sel.rangeCount === 0) {
        pendingRef.current = null;
        setDd(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = range.startContainer;
      if (container.nodeType !== Node.TEXT_NODE) {
        pendingRef.current = null;
        setDd(null);
        return;
      }
      const before = container.textContent!.slice(0, range.startOffset);
      const match = /@(\w*)$/.exec(before);
      if (!match) {
        pendingRef.current = null;
        setDd(null);
        return;
      }
      const query = match[1].toLowerCase();
      const items = members
        .filter((m) => !query || m.name.toLowerCase().includes(query))
        .slice(0, 7);
      if (items.length === 0) {
        pendingRef.current = null;
        setDd(null);
        return;
      }
      pendingRef.current = { atIndex: match.index, textNode: container as Text, query: match[1] };
      const rect = el.getBoundingClientRect();
      setDd({
        items,
        activeIdx: 0,
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }

    function doInsert(member: MentionMember) {
      const el = editorRef.current;
      const state = pendingRef.current;
      if (!el || !state) return;

      const { atIndex, textNode, query } = state;
      const before = textNode.textContent!.slice(0, atIndex);
      const after = textNode.textContent!.slice(atIndex + 1 + query.length);

      const beforeNode = document.createTextNode(before);
      const span = makeMentionSpan(member.name, member.id);
      // Use a ZWS as cursor anchor so caret lands right after the chip
      const afterNode = document.createTextNode(after.length > 0 ? after : "\u200B");

      const parent = textNode.parentNode!;
      parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(span, textNode);
      parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);

      // Move cursor to afterNode start
      const sel = window.getSelection()!;
      const range = document.createRange();
      range.setStart(afterNode, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      pendingRef.current = null;
      setDd(null);
      emitChange();
    }

    // ── Keyboard ─────────────────────────────────────────────────────────────

    function removeMentionNode(node: ChildNode) {
      const parent = node.parentNode!;
      const range = document.createRange();
      range.setStartBefore(node);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      parent.removeChild(node);
      emitChange();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      // ── Dropdown navigation ──────────────────────────────────────────────
      if (dd) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setDd((d) => d ? { ...d, activeIdx: (d.activeIdx + 1) % d.items.length } : d);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setDd((d) => d ? { ...d, activeIdx: (d.activeIdx - 1 + d.items.length) % d.items.length } : d);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          doInsert(dd.items[dd.activeIdx]);
          return;
        }
        if (e.key === "Escape") {
          pendingRef.current = null;
          setDd(null);
          return;
        }
      }

      // ── Backspace: delete whole mention span atomically ──────────────────
      if (e.key === "Backspace") {
        const sel = window.getSelection();
        if (sel?.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const { startContainer, startOffset } = range;

          // Cursor at start of a text node — check previous sibling
          if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
            const prev = startContainer.previousSibling as HTMLElement | null;
            if (prev?.dataset?.mentionId) {
              e.preventDefault();
              removeMentionNode(prev);
              return;
            }
          }

          // Cursor directly in the editor div
          if (startContainer === editorRef.current && startOffset > 0) {
            const child = (startContainer as HTMLElement).childNodes[startOffset - 1] as HTMLElement;
            if (child?.dataset?.mentionId) {
              e.preventDefault();
              removeMentionNode(child);
              return;
            }
          }
        }
      }

      // ── Delete: delete whole mention span atomically ─────────────────────
      if (e.key === "Delete") {
        const sel = window.getSelection();
        if (sel?.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const { startContainer, startOffset } = range;

          // Cursor at end of a text node — check next sibling
          if (
            startContainer.nodeType === Node.TEXT_NODE &&
            startOffset === (startContainer.textContent?.replace(/\u200B/g, "").length ?? 0)
          ) {
            const next = startContainer.nextSibling as HTMLElement | null;
            if (next?.dataset?.mentionId) {
              e.preventDefault();
              removeMentionNode(next);
              return;
            }
          }

          // Cursor directly in the editor div
          if (startContainer === editorRef.current) {
            const child = (startContainer as HTMLElement).childNodes[startOffset] as HTMLElement;
            if (child?.dataset?.mentionId) {
              e.preventDefault();
              removeMentionNode(child);
              return;
            }
          }
        }
      }

      onKeyDown?.(e);
    }

    // ── Paste: strip HTML, insert as plain text ───────────────────────────────
    function handlePaste(e: React.ClipboardEvent) {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertText", false, text);
      emitChange();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const minHeight = `${rows * 1.5}rem`;

    return (
      <div className="relative w-full">
        {!hasContent && placeholder ? (
          <span className="pointer-events-none absolute left-0 top-0 px-3 py-2 text-sm text-muted-foreground select-none">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={disabled ? false : true}
          suppressContentEditableWarning
          className={cn(
            "block w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "whitespace-pre-wrap break-words overflow-y-auto",
            // Mention chip styling
            "[&_.mention]:text-primary [&_.mention]:select-all",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
          style={{ minHeight }}
          onInput={() => { emitChange(); detectMention(); }}
          onKeyDown={handleKeyDown}
          onKeyUp={detectMention}
          onMouseUp={detectMention}
          onBlur={(e) => {
            setTimeout(() => { pendingRef.current = null; setDd(null); }, 150);
            onBlur?.(e);
          }}
          onPaste={handlePaste}
        />
        {dd &&
          createPortal(
            <div
              style={{
                position: "absolute",
                top: dd.top,
                left: dd.left,
                width: Math.max(dd.width, 200),
                zIndex: 9999,
              }}
              className="overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl"
            >
              {dd.items.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    doInsert(m);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-muted",
                    i === dd.activeIdx && "bg-muted",
                  )}
                >
                  <UserAvatar name={m.name} image={m.image} userId={m.id} className="size-5 shrink-0" />
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);
