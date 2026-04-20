import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  FolderKanban,
  FolderPlus,
  LogOut,
  Plus,
  Tags,
  UserPlus,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { useProjects } from "@/api/projects/query";
import { useUsers } from "@/api/users/query";
import { useCompanies } from "@/api/companies/query";
import { useTags } from "@/api/tags/query";
import { getProjectColor } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export function CommandPalette() {
  const navigate = useNavigate();

  const commandOpen = useUIStore((s) => s.commandOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const toggleCommand = useUIStore((s) => s.toggleCommand);
  const openUserDetail = useUIStore((s) => s.openUserDetail);
  const setPendingAction = useUIStore((s) => s.setPendingAction);

  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";
  const canManage = isAdmin || role === "manager";

  const { data: projects } = useProjects();
  const { data: users } = useUsers({}, { enabled: canManage });
  const { data: companies } = useCompanies({ enabled: isAdmin });
  const { data: tags } = useTags();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommand();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleCommand]);

  // "g then X" leader-key shortcuts, Linear/Notion style
  useEffect(() => {
    let leader = false;
    let leaderTimeout: ReturnType<typeof setTimeout> | null = null;
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (commandOpen) return;
      if (!leader) {
        if (e.key === "g") {
          leader = true;
          if (leaderTimeout) clearTimeout(leaderTimeout);
          leaderTimeout = setTimeout(() => (leader = false), 1200);
        }
        return;
      }
      leader = false;
      if (leaderTimeout) clearTimeout(leaderTimeout);
      const k = e.key.toLowerCase();
      if (k === "p") navigate({ to: "/" });
      else if (k === "u" && canManage) navigate({ to: "/users" });
      else if (k === "c" && isAdmin) navigate({ to: "/companies" });
      else if (k === "t" && canManage) navigate({ to: "/tags" });
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (leaderTimeout) clearTimeout(leaderTimeout);
    };
  }, [commandOpen, canManage, isAdmin, navigate]);

  function runCommand(command: () => void) {
    setCommandOpen(false);
    setTimeout(command, 0);
  }

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  const topProjects = useMemo(() => (projects ?? []).slice(0, 8), [projects]);
  const topUsers = useMemo(() => (users ?? []).slice(0, 6), [users]);
  const topCompanies = useMemo(() => (companies ?? []).slice(0, 6), [companies]);
  const topTags = useMemo(() => (tags ?? []).slice(0, 8), [tags]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search projects, users, commands…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {topProjects.length > 0 && (
          <CommandGroup heading="Projects">
            {topProjects.map((p) => {
              const color = getProjectColor(p.id);
              return (
                <CommandItem
                  key={`project-${p.id}`}
                  value={`project ${p.name} ${p.company?.name ?? ""}`}
                  onSelect={() =>
                    runCommand(() =>
                      navigate({
                        to: "/projects/$id/viewer",
                        params: { id: String(p.id) },
                      }),
                    )
                  }
                >
                  <div
                    className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-[5px] text-white"
                    style={{ backgroundColor: color }}
                  >
                    <FolderKanban className="size-3" />
                  </div>
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.company?.name ? (
                    <span className="ml-2 truncate text-[11px] text-text-tertiary">
                      {p.company.name}
                    </span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {canManage && topUsers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Users">
              {topUsers.map((u) => (
                <CommandItem
                  key={`user-${u.id}`}
                  value={`user ${u.name} ${u.email}`}
                  onSelect={() => runCommand(() => openUserDetail(u.id))}
                >
                  <UserAvatar
                    name={u.name}
                    image={u.image}
                    userId={u.id}
                    className="mr-2 size-5"
                  />
                  <span className="flex-1 truncate">{u.name}</span>
                  <span className="ml-2 truncate text-[11px] text-text-tertiary">
                    {u.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {isAdmin && topCompanies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Companies">
              {topCompanies.map((c) => (
                <CommandItem
                  key={`company-${c.id}`}
                  value={`company ${c.name}`}
                  onSelect={() =>
                    runCommand(() => navigate({ to: "/companies" }))
                  }
                >
                  <div className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-blue-500 text-white">
                    <Building2 className="size-3" />
                  </div>
                  <span className="flex-1 truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canManage && topTags.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tags">
              {topTags.map((t) => (
                <CommandItem
                  key={`tag-${t.id}`}
                  value={`tag ${t.name}`}
                  onSelect={() =>
                    runCommand(() => {
                      setPendingAction({ type: "edit-tag", id: t.id });
                      navigate({ to: "/tags" });
                    })
                  }
                >
                  <div
                    className="mr-2 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 truncate">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem
            value="go projects dashboard"
            onSelect={() => runCommand(() => navigate({ to: "/" }))}
          >
            <FolderKanban className="mr-2 size-4 text-emerald-500" />
            <span>Go to Projects</span>
            <CommandShortcut>
              <KbdGroup>
                <Kbd>G</Kbd>
                <Kbd>P</Kbd>
              </KbdGroup>
            </CommandShortcut>
          </CommandItem>
          {canManage && (
            <CommandItem
              value="go users"
              onSelect={() => runCommand(() => navigate({ to: "/users" }))}
            >
              <Users className="mr-2 size-4 text-indigo-500" />
              <span>Go to Users</span>
              <CommandShortcut>
                <KbdGroup>
                  <Kbd>G</Kbd>
                  <Kbd>U</Kbd>
                </KbdGroup>
              </CommandShortcut>
            </CommandItem>
          )}
          {isAdmin && (
            <CommandItem
              value="go companies"
              onSelect={() => runCommand(() => navigate({ to: "/companies" }))}
            >
              <Building2 className="mr-2 size-4 text-blue-500" />
              <span>Go to Companies</span>
              <CommandShortcut>
                <KbdGroup>
                  <Kbd>G</Kbd>
                  <Kbd>C</Kbd>
                </KbdGroup>
              </CommandShortcut>
            </CommandItem>
          )}
          {canManage && (
            <CommandItem
              value="go tags"
              onSelect={() => runCommand(() => navigate({ to: "/tags" }))}
            >
              <Tags className="mr-2 size-4 text-violet-500" />
              <span>Go to Tags</span>
              <CommandShortcut>
                <KbdGroup>
                  <Kbd>G</Kbd>
                  <Kbd>T</Kbd>
                </KbdGroup>
              </CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        {canManage && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {isAdmin && (
                <CommandItem
                  value="create new project"
                  onSelect={() =>
                    runCommand(() => {
                      setPendingAction({ type: "create-project" });
                      navigate({ to: "/" });
                    })
                  }
                >
                  <FolderPlus className="mr-2 size-4" />
                  <span>Create project</span>
                </CommandItem>
              )}
              <CommandItem
                value="create new user"
                onSelect={() =>
                  runCommand(() => {
                    setPendingAction({ type: "create-user" });
                    navigate({ to: "/users" });
                  })
                }
              >
                <UserPlus className="mr-2 size-4" />
                <span>Create user</span>
              </CommandItem>
              {isAdmin && (
                <CommandItem
                  value="create new company"
                  onSelect={() =>
                    runCommand(() => {
                      setPendingAction({ type: "create-company" });
                      navigate({ to: "/companies" });
                    })
                  }
                >
                  <Plus className="mr-2 size-4" />
                  <span>Create company</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            value="logout sign out"
            onSelect={() => runCommand(() => void handleLogout())}
          >
            <LogOut className="mr-2 size-4" />
            <span>Log out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
