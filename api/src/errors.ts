// Errores de dominio: los servicios los lanzan y el errorHandler los traduce a HTTP.
// Así un servicio dice "no existe" sin saber que eso es un 404 (no depende de Express).

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

/** 400: los datos de entrada no cumplen el contrato. */
export class ValidationError extends Error {
  constructor(readonly detalles: DetalleValidacion[]) {
    super("Datos inválidos");
    this.name = "ValidationError";
  }
}

/** 404: no existe, o es de otro gimnasio (para el usuario es lo mismo). */
export class NotFoundError extends Error {
  constructor(recurso: string) {
    super(`${recurso} no encontrado`);
    this.name = "NotFoundError";
  }
}

/** 409: choca con algo que ya existe (p. ej. un nombre único). El mensaje se muestra al usuario. */
export class ConflictError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConflictError";
  }
}
