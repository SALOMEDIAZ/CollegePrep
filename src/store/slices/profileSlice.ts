import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppUser } from "../../types/user";

export type ProfileState = {
  user: AppUser | null;
  loading: boolean;
};

const initialState: ProfileState = {
  user: null,
  loading: false,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    // guardo el usuario que acaba de loguearse
    setUser(state, action: PayloadAction<AppUser>) {
      state.user = action.payload;
    },
    // limpio el usuario cuando se cierra sesión
    clearUser(state) {
      state.user = null;
    },
    // controlo el estado de carga para mostrar pantallas de loading
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = profileSlice.actions;
export default profileSlice.reducer;
