import { createSlice } from '@reduxjs/toolkit';

type AuthState = {
  user: null;
  authReady: boolean;
};

const initialState: AuthState = {
  user: null,
  authReady: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    restoreFinished(state) {
      state.user = null;
      state.authReady = true;
    },
  },
});

export const { restoreFinished } = authSlice.actions;
export default authSlice.reducer;
