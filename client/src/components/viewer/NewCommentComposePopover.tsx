"use client";

import { useState } from "react";
import { ArrowRight, Tag } from "lucide-react";

import { UserAvatar } from "@/components/shared/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { Tag as TagType, User } from "@/types";

interface NewCommentComposePopoverProps {
  currentUser: User | null;
  tagOptions: TagType[];
  selectedTagIds: string[];
  onToggleTag: (id: string) => void;
  onSubmit: (body: string) => void | Promise<void>;
  onCancel: () => void;
}

export function NewCommentComposePopover({
  currentUser,
  tagOptions,
  selectedTagIds,
  onToggleTag,
  onSubmit,
  onCancel,
}: NewCommentComposePopoverProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  async function handleSubmit() {
    const t = text.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await onSubmit(t);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTags = tagOptions.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="flex w-72 flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-popover p-3 shadow-xl">
      {/* Author row */}
      <div className="flex items-center gap-2">
        {currentUser ? (
          <UserAvatar name={currentUser.name} image={currentUser.image ?? null} className="size-7 shrink-0" />
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">Add a comment</span>
      </div>

      {/* Textarea */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Write feedback…"
        disabled={submitting}
        className="resize-none text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
      />

      {/* Selected tags preview */}
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${t.color}22`, color: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* Tag selector */}
      {tagOptions.length > 0 ? (
        <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 justify-start gap-1.5 px-2 text-xs text-muted-foreground">
              <Tag className="size-3.5" />
              {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}` : "Add tags"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTag(t.id)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge
                    variant={selectedTagIds.includes(t.id) ? "default" : "outline"}
                    className="cursor-pointer text-xs transition-opacity"
                    style={
                      selectedTagIds.includes(t.id)
                        ? { backgroundColor: t.color, color: "#fff", borderColor: t.color }
                        : { borderColor: `${t.color}66`, color: t.color }
                    }
                  >
                    {t.name}
                  </Badge>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5 px-3 text-xs"
          disabled={!text.trim() || submitting}
          onClick={() => void handleSubmit()}
        >
          Post
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
