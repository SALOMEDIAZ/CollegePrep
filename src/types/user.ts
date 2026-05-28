// USUARIO QUE SE GUARDA EN REDUX (DATOS SERIALIZABLES)
// este tipo es liviano para no guardar el objeto completo de firebase
export type AppUser = {
  // uid de firebase
  id: string;
  // paso del codigo
  // correo con el que inicio sesion
  email: string;
  displayName: string | null;
  // paso del codigo
  // url de foto si el usuario subio avatar en firebase
  photoURL: string | null;
};
