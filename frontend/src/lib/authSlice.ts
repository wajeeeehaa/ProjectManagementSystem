import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  roleTitle: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  authReady: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.authReady = true;
    },
    signedOut(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.authReady = true;
    },
  },
});

export const { signedIn, signedOut } = authSlice.actions;
export default authSlice.reducer;
