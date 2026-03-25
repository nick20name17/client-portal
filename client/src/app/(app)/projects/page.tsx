"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderOpenIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { pageShellClass } from "@/lib/page-shell";
import { createProject } from "@/api/projects/mutations";
import { projectKeys, projectsQueryOptions } from "@/api/projects/queries";
import { queryClient } from "@/providers/react-query";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    repoUrl: z.string().url("Must be a valid URL"),
});

type FormValues = z.infer<typeof schema>;

export default function ProjectsPage() {
    const [open, setOpen] = useState(false);
    const { data: session } = authClient.useSession();
    const isAdmin = (session?.user as any)?.role === "admin";

    const { data: projects, isLoading } = useQuery(projectsQueryOptions());

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema) });

    const mutation = useMutation({
        mutationFn: createProject,
        onSuccess: () => {
            toast.success("Project created");
            reset();
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
        onError: (err) => toast.error(err.message),
    });

    const onSubmit = (values: FormValues) => mutation.mutate(values);

    return (
        <div className={pageShellClass}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Projects</h1>
                    <p className="text-sm text-muted-foreground">
                        {isAdmin
                            ? "Manage all projects"
                            : "Your assigned projects"}
                    </p>
                </div>

                {isAdmin && (
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button size="sm">
                                <PlusIcon />
                                New project
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Create project</SheetTitle>
                            </SheetHeader>
                            <form
                                onSubmit={handleSubmit(onSubmit)}
                                className="mt-6 space-y-4 px-4"
                            >
                                <div className="space-y-1.5">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="My project"
                                        aria-invalid={!!errors.name}
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <p className="text-xs text-destructive">
                                            {errors.name.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description">
                                        Description{" "}
                                        <span className="text-muted-foreground">
                                            (optional)
                                        </span>
                                    </Label>
                                    <Input
                                        id="description"
                                        placeholder="Short description"
                                        {...register("description")}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="repoUrl">
                                        GitHub repo URL
                                    </Label>
                                    <Input
                                        id="repoUrl"
                                        placeholder="https://github.com/owner/repo"
                                        aria-invalid={!!errors.repoUrl}
                                        {...register("repoUrl")}
                                    />
                                    {errors.repoUrl && (
                                        <p className="text-xs text-destructive">
                                            {errors.repoUrl.message}
                                        </p>
                                    )}
                                </div>

                                {mutation.error && (
                                    <p className="text-sm text-destructive">
                                        {mutation.error.message}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting
                                        ? "Creating…"
                                        : "Create project"}
                                </Button>
                            </form>
                        </SheetContent>
                    </Sheet>
                )}
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            ) : !projects?.length ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <FolderOpenIcon className="size-10 text-muted-foreground" />
                    <p className="text-muted-foreground">No projects yet</p>
                    {isAdmin && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpen(true)}
                        >
                            Create your first project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="group"
                        >
                            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FolderOpenIcon className="size-4 text-primary" />
                                        {project.name}
                                    </CardTitle>
                                    {project.description && (
                                        <CardDescription>
                                            {project.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {project.repoUrl}
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
