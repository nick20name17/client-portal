"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FileIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { syncFilesFromGithub } from "@/api/files/mutations";
import { fileKeys, filesQueryOptions } from "@/api/files/queries";
import { projectQueryOptions } from "@/api/projects/queries";
import { queryClient } from "@/providers/react-query";
import { pageShellClass } from "@/lib/page-shell";
import { cn } from "@/lib/utils";

export default function ProjectDetailPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = use(params);
    const id = Number(projectId);
    const pathname = usePathname();

    const { data: project, isLoading: projectLoading } = useQuery(
        projectQueryOptions(id),
    );
    const { data: files, isLoading: filesLoading } = useQuery(
        filesQueryOptions(id),
    );

    const sortedFiles = [...(files ?? [])].sort((a, b) =>
        a.path.localeCompare(b.path),
    );

    const syncMutation = useMutation({
        mutationFn: () => syncFilesFromGithub(id),
        onSuccess: (list) => {
            toast.success(
                list.length
                    ? `Synced ${list.length} HTML file${list.length === 1 ? "" : "s"}`
                    : "Sync complete (no .html files in repo)",
            );
            queryClient.invalidateQueries({ queryKey: fileKeys.all(id) });
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <div className={pageShellClass}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    {projectLoading ? (
                        <Skeleton className="h-7 w-40" />
                    ) : (
                        <>
                            <h1 className="text-xl font-semibold">
                                {project?.name}
                            </h1>
                            {project?.description && (
                                <p className="text-sm text-muted-foreground">
                                    {project.description}
                                </p>
                            )}
                        </>
                    )}
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    disabled={syncMutation.isPending || filesLoading}
                    onClick={() => syncMutation.mutate()}
                >
                    <RefreshCwIcon
                        className={cn(
                            "size-4",
                            syncMutation.isPending && "animate-spin",
                        )}
                    />
                    {syncMutation.isPending ? "Syncing…" : "Sync from GitHub"}
                </Button>
            </div>

            {filesLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-lg" />
                    ))}
                </div>
            ) : !sortedFiles.length ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <FileIcon className="size-10 text-muted-foreground" />
                    <p className="max-w-sm text-muted-foreground">
                        No HTML files found for this repository. Add{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            .html
                        </code>{" "}
                        files to the repo on GitHub, then sync.
                    </p>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={syncMutation.isPending}
                        onClick={() => syncMutation.mutate()}
                    >
                        <RefreshCwIcon className="size-4" />
                        Sync from GitHub
                    </Button>
                </div>
            ) : (
                <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        HTML pages
                    </p>
                    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                        {sortedFiles.map((file) => {
                            const href = `/projects/${id}/files/${file.id}`;
                            const active =
                                pathname === href ||
                                pathname?.startsWith(`${href}/`);
                            return (
                                <Link
                                    key={file.id}
                                    href={href}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    {file.path}
                                </Link>
                            );
                        })}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Open a tab above to preview the page and leave comments.
                    </p>
                </div>
            )}
        </div>
    );
}
