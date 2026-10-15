import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WorkspaceRole } from './workspaceRoles';

export type Workspace = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role: WorkspaceRole;
};

type WorkspaceState = {
  items: Workspace[];
  activeWorkspaceId: string | null;
};

const initialState: WorkspaceState = { items: [], activeWorkspaceId: null };

const workspaceSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    workspacesLoaded(state, action: PayloadAction<Workspace[]>) {
      state.items = action.payload;
    },
    workspaceSaved(state, action: PayloadAction<Workspace>) {
      const index = state.items.findIndex((workspace) => workspace.id === action.payload.id);
      if (index >= 0) state.items[index] = action.payload;
      else state.items.push(action.payload);
    },
    workspaceRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((workspace) => workspace.id !== action.payload);
      if (state.activeWorkspaceId === action.payload) state.activeWorkspaceId = null;
    },
    activeWorkspaceChanged(state, action: PayloadAction<string | null>) {
      state.activeWorkspaceId = action.payload;
    },
    workspacesCleared(state) {
      state.items = [];
      state.activeWorkspaceId = null;
    },
  },
});

export const {
  activeWorkspaceChanged,
  workspaceRemoved,
  workspaceSaved,
  workspacesCleared,
  workspacesLoaded,
} = workspaceSlice.actions;
export default workspaceSlice.reducer;
