// Error con código HTTP asociado, para distinguir un fallo del cliente (4xx)
// de un fallo del servidor (5xx) sin llenar los controladores de try/catch.
export class HttpError extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
    this.name = "HttpError";
  }
}

export const errorPeticion = (mensaje) => new HttpError(400, mensaje);
export const errorNoEncontrado = (mensaje) => new HttpError(404, mensaje);

// Envuelve un controlador async para que sus rechazos lleguen al middleware
// de errores de Express en lugar de quedar como promesas no capturadas.
export function asyncHandler(controlador) {
  return (req, res, next) => Promise.resolve(controlador(req, res)).catch(next);
}
