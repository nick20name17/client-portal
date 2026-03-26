"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Anchor, Tag } from "@/types";

export function CommentForm({
  disabled,
  anchor,
  parentId,
  tagOptions,
  selectedTagIds,
  onToggleTag,
  onSubmit,
  onCancel,
}: {
  disabled?: boolean;
  anchor: Anchor | null;
  parentId?: string | null;
  tagOptions: Tag[];
  selectedTagIds: string[];
  onToggleTag: (id: string) => void;
  onSubmit: (body: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    try {
      await onSubmit(t);
      setText("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      {anchor ? (
        <p className="text-xs text-muted-foreground">
          On{" "}
          <span className="font-mono text-foreground">
            &lt;{anchor.tagName.toLowerCase()}&gt;
          </span>
          {anchor.textContent ? ` · “${anchor.textContent.slice(0, 40)}…”` : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">General comment (no element selected)</p>
      )}
      {parentId ? <p className="text-xs font-medium text-primary">Replying to thread</p> : null}
      <div className="space-y-2">
        <Label className="text-xs">Comment</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Write feedback…"
          disabled={disabled || loading}
        />
      </div>
      {tagOptions.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={selectedTagIds.includes(t.id)}
                  onChange={() => onToggleTag(t.id)}
                />
                <span style={{ color: t.color }}>{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={loading || !text.trim()}>
          Post
        </Button>
      </div>
    </div>
  );
}
