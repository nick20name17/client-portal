"use client";

import { fileQueryOptions } from "@/api/files/queries";
import { CommentOverlay } from "@/components/comment-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";

export default function FileViewerPage({
    params,
}: {
    params: Promise<{ projectId: string; fileId: string }>;
}) {
    const { projectId, fileId } = use(params);
    const pid = Number(projectId);
    const fid = Number(fileId);

    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const { data: file, isLoading } = useQuery(fileQueryOptions(pid, fid));

    useEffect(() => {
        if (!file?.githubUrl) return;

        let cancelled = false;
        fetch(file.githubUrl)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch file");
                return res.text();
            })
            .then((text) => {
                if (!cancelled) setHtmlContent(text);
            })
            .catch((err) => {
                if (!cancelled)
                    setFetchError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load file",
                    );
            });

        return () => {
            cancelled = true;
        };
    }, [file?.githubUrl]);

    if (isLoading) {
        return (
            <div className="p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-[60vh] w-full rounded-xl" />
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
                <p className="text-destructive">{fetchError}</p>
            </div>
        );
    }

    if (!htmlContent) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
                <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading file…</p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b px-4 py-2">
                <p className="text-sm font-medium">{file?.path}</p>
                <p className="text-xs text-muted-foreground truncate">
                    {file?.githubUrl}
                </p>
            </div>
            <div className="flex-1 min-h-0">
                <CommentOverlay
                    projectId={pid}
                    fileId={fid}
                    htmlContent={htmlContent}
                />
            </div>
        </div>
    );
}
