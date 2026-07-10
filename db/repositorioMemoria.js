import crypto from "crypto";

// Implementación del repositorio en memoria del proceso.
//
// Pensada para desarrollo, demos y pruebas: no requiere Docker ni MongoDB.
// Los datos viven en un Map y se pierden al reiniciar el servidor.
export function crearRepositorioMemoria() {
  const conversaciones = new Map();

  // Copia defensiva: sin ella, quien recibe el documento podría mutar el
  // estado interno del repositorio, algo que con Mongo nunca ocurriría.
  const clonar = (documento) => structuredClone(documento);

  return {
    tipo: "memoria",

    // Los ids son UUID; cualquier cadena no vacía sin formato UUID se rechaza.
    esIdValido: (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),

    async crear(documento) {
      const id = crypto.randomUUID();

      conversaciones.set(id, { ...clonar(documento), _id: id });

      return id;
    },

    async obtenerPorId(id) {
      const conversacion = conversaciones.get(id);

      if (!conversacion || conversacion.eliminado) return null;

      return clonar(conversacion);
    },

    async listarRecientes(limite) {
      return [...conversaciones.values()]
        .filter((c) => !c.eliminado)
        .sort((a, b) => b.fecha - a.fecha)
        .slice(0, limite)
        .map(clonar);
    },

    async agregarMensajes(id, mensajes) {
      const conversacion = conversaciones.get(id);

      if (!conversacion || conversacion.eliminado) return false;

      conversacion.mensajes.push(...clonar(mensajes));

      return true;
    },

    async marcarEliminada(id) {
      const conversacion = conversaciones.get(id);

      if (!conversacion || conversacion.eliminado) return false;

      conversacion.eliminado = true;
      conversacion.fechaEliminado = new Date();

      return true;
    },

    async cerrar() {
      conversaciones.clear();
    },
  };
}
