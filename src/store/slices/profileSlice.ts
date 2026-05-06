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
    // ESTO GUARDA EN REDUX EL USUARIO ACTUAL
    setUser(state, action: PayloadAction<AppUser>) {
      state.user = action.payload;
    },
    // ESTO LIMPIA USUARIO AL CERRAR SESION
    clearUser(state) {
      state.user = null;
    },
    // ESTO CONTROLA CARGA (PANTALLAS QUE LO NECESITEN)
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = profileSlice.actions;
export default profileSlice.reducer;
