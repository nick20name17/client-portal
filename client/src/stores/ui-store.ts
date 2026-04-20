import { create } from "zustand";

export type PendingAction =
  | { type: "create-project" }
  | { type: "create-user" }
  | { type: "create-company" }
  | { type: "edit-tag"; id: number }
  | null;

interface UIStore {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;

  userDetailId: string | null;
  openUserDetail: (id: string) => void;
  closeUserDetail: () => void;

  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  consumePendingAction: () => PendingAction;
}

export const useUIStore = create<UIStore>((set, get) => ({
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  userDetailId: null,
  openUserDetail: (id) => set({ userDetailId: id, commandOpen: false }),
  closeUserDetail: () => set({ userDetailId: null }),

  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),
  consumePendingAction: () => {
    const action = get().pendingAction;
    if (action) set({ pendingAction: null });
    return action;
  },
}));
