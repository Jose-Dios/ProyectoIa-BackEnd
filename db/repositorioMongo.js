import { MongoClient, ObjectId } from "mongodb";

// Implementación del repositorio de conversaciones sobre MongoDB.
export async function crearRepositorioMongo(bdLink) {
  const cliente = new MongoClient(bdLink);

  await cliente.connect();
  console.log("Conectado a MongoDB");

  const conversaciones = cliente.db().collection("conversaciones");

  // El listado del historial filtra por `eliminado` y ordena por `fecha`.
  await conversaciones.createIndex({ eliminado: 1, fecha: -1 });

  return {
    tipo: "mongo",

    esIdValido: (id) => ObjectId.isValid(id),

    async crear(documento) {
      const { insertedId } = await conversaciones.insertOne(documento);

      return insertedId.toString();
    },

    async obtenerPorId(id) {
      return conversaciones.findOne({ _id: new ObjectId(id), eliminado: false });
    },

    async listarRecientes(limite) {
      return conversaciones.find({ eliminado: false }).sort({ fecha: -1 }).limit(limite).toArray();
    },

    async agregarMensajes(id, mensajes) {
      // $push evita reescribir el array completo y perder mensajes añadidos
      // por otra petición concurrente sobre la misma conversación.
      const resultado = await conversaciones.updateOne(
        { _id: new ObjectId(id), eliminado: false },
        { $push: { mensajes: { $each: mensajes } } }
      );

      return resultado.matchedCount > 0;
    },

    async marcarEliminada(id) {
      const resultado = await conversaciones.updateOne(
        { _id: new ObjectId(id), eliminado: false },
        { $set: { eliminado: true, fechaEliminado: new Date() } }
      );

      return resultado.matchedCount > 0;
    },

    async cerrar() {
      await cliente.close();
    },
  };
}
