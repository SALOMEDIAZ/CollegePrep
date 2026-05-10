// USUARIO QUE SE GUARDA EN REDUX (DATOS SERIALIZABLES)
export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
};
