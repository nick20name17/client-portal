
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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
  parentId?: number | null;
  tagOptions: Tag[];
  selectedTagIds: number[];
  onToggleTag: (id: number) => void;
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
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3 dark:bg-muted/30">
      {anchor ? (
        <p className="text-xs text-muted-foreground">
          On{" "}
          <span className="font-mono text-foreground">
            &lt;{anchor.tagName.toLowerCase()}&gt;
          </span>
          {anchor.textContent ? ` · "${anchor.textContent.slice(0, 40)}…"` : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">General comment (no element selected)</p>
      )}
      {parentId ? <p className="text-xs font-medium text-primary">Replying to thread</p> : null}
      <Field>
        <FieldLabel className="text-xs">Comment</FieldLabel>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Write feedback…"
          disabled={disabled || loading}
        />
      </Field>
      {tagOptions.length > 0 ? (
        <Field>
          <FieldLabel className="text-xs">Tags</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {tagOptions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggleTag(t.id)}
                className="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={
                  selectedTagIds.includes(t.id)
                    ? { backgroundColor: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }
                    : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {loading ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
