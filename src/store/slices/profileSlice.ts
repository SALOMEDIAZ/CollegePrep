// createSlice arma acciones y reducer en un solo lugar
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
// tipos del usuario y del perfil en supabase
import type { AppUser } from "../../types/user";
import type { ProfileRow } from "../../types/profile";

// estado del perfil que vive en redux
export type ProfileState = {
  // usuario de firebase (email, nombre, foto)
  user: AppUser | null;
  // id de la fila profiles en supabase
  supabaseProfileId: string | null;
  // copia de la fila para no pedirla de nuevo en profile
  profileRow: ProfileRow | null;
  // flag opcional de carga global del perfil
  loading: boolean;
};

// valores por defecto antes de iniciar sesion
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
    // guardo fila de perfil e id de supabase en cache
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
    // limpio todo cuando cierra sesion
    clearUser(state) {
      state.user = null;
      state.supabaseProfileId = null;
      state.profileRow = null;
    },
    // flag de carga para mostrar spinner
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, setProfileCache, clearUser, setLoading } = profileSlice.actions;
export default profileSlice.reducer;
