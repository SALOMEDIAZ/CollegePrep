import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppUser } from "../../types/user";
import type { ProfileRow } from "../../types/profile";

export type ProfileState = {
  user: AppUser | null;
  supabaseProfileId: string | null;
  profileRow: ProfileRow | null;
  loading: boolean;
};

const initialState: ProfileState = {
  user: null,
  supabaseProfileId: null,
  profileRow: null,
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
    setProfileCache(
      state,
      action: PayloadAction<{
        row: ProfileRow;
        supabaseId: string;
        budgetPct?: number | null;
      }>,
    ) {
      state.profileRow = action.payload.row;
      state.supabaseProfileId = action.payload.supabaseId;
    },
    clearUser(state) {
      state.user = null;
      state.supabaseProfileId = null;
      state.profileRow = null;
    },
    // controlo el estado de carga para mostrar pantallas de loading
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, setProfileCache, clearUser, setLoading } = profileSlice.actions;
export default profileSlice.reducer;
