"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FileIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { pageShellClass } from "@/lib/page-shell";
import { addFile } from "@/api/files/mutations";
import { fileKeys, filesQueryOptions } from "@/api/files/queries";
import { projectQueryOptions } from "@/api/projects/queries";
import { queryClient } from "@/providers/react-query";

const DEFAULT_FILE = "index.html";

export default function ProjectDetailPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = use(params);
    const id = Number(projectId);

    const { data: session } = authClient.useSession();
    const isAdmin = (session?.user as any)?.role === "admin";

    const { data: project, isLoading: projectLoading } = useQuery(
        projectQueryOptions(id),
    );
    const { data: files, isLoading: filesLoading } = useQuery(
        filesQueryOptions(id),
    );

    const alreadyAdded = files?.some((f) => f.path === DEFAULT_FILE);

    const mutation = useMutation({
        mutationFn: () => addFile(id, DEFAULT_FILE),
        onSuccess: () => {
            toast.success(`${DEFAULT_FILE} added`);
            queryClient.invalidateQueries({ queryKey: fileKeys.all(id) });
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <div className={pageShellClass}>
            <div className="mb-6 flex items-center justify-between">
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

                {isAdmin && !alreadyAdded && (
                    <Button
                        size="sm"
                        disabled={mutation.isPending || filesLoading}
                        onClick={() => mutation.mutate()}
                    >
                        <PlusIcon />
                        {mutation.isPending ? "Adding…" : "Add index.html"}
                    </Button>
                )}
            </div>

            {filesLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : !files?.length ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <FileIcon className="size-10 text-muted-foreground" />
                    <p className="text-muted-foreground">No files yet</p>
                    {isAdmin && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate()}
                        >
                            Add index.html
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {files.map((file) => (
                        <Link
                            key={file.id}
                            href={`/projects/${id}/files/${file.id}`}
                        >
                            <Card className="cursor-pointer transition-shadow hover:shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <FileIcon className="size-4 text-primary" />
                                        {file.path}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {file.githubUrl}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
