"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { pageShellClass } from "@/lib/page-shell";
import { updateUserRole } from "@/api/users/mutations";
import { userKeys, usersQueryOptions } from "@/api/users/queries";
import { queryClient } from "@/providers/react-query";

export default function AdminUsersPage() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const isAdmin = (session?.user as any)?.role === "admin";

    useEffect(() => {
        if (!isPending && !isAdmin) {
            router.replace("/projects");
        }
    }, [isPending, isAdmin, router]);

    const { data: users, isLoading } = useQuery({
        ...usersQueryOptions(),
        enabled: isAdmin,
    });

    const roleMutation = useMutation({
        mutationFn: ({
            id,
            role,
        }: {
            id: string;
            role: "admin" | "client";
        }) => updateUserRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
        },
    });

    if (!isAdmin) return null;

    return (
        <div className={pageShellClass}>
            <div className="mb-6">
                <h1 className="text-xl font-semibold">Users</h1>
                <p className="text-sm text-muted-foreground">
                    Manage user roles
                </p>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    Name
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    Role
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {users?.map((user) => (
                                <tr key={user.id} className="bg-card">
                                    <td className="px-4 py-3 font-medium">
                                        {user.name}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {user.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                user.role === "admin"
                                                    ? "bg-primary/10 text-primary"
                                                    : "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {user.id !== session?.user?.id && (
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                disabled={
                                                    roleMutation.isPending
                                                }
                                                onClick={() =>
                                                    roleMutation.mutate({
                                                        id: user.id,
                                                        role:
                                                            user.role ===
                                                            "admin"
                                                                ? "client"
                                                                : "admin",
                                                    })
                                                }
                                            >
                                                Make{" "}
                                                {user.role === "admin"
                                                    ? "client"
                                                    : "admin"}
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
