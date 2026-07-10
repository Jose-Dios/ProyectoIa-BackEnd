import express from "express";
import multer from "multer";
import {
  analizar,
  chat,
  historial,
  analizarProyectoIA,
  obtenerConversacion,
  eliminarConversacion,
} from "../controllers/controllerIA.js";
import { asyncHandler } from "../utils/errores.js";
import { config } from "../config/env.js";

export default function crearRouterAnalisis(repo) {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    // Sin límites, una subida grande agota la memoria del proceso.
    limits: {
      fileSize: config.analisis.maxBytesPorArchivo,
      files: 500,
    },
  });

  // Capa intermedia entre la petición HTTP y los controladores: inyecta el
  // repositorio y encamina cualquier error al middleware central de errores.
  const conRepo = (controlador) => asyncHandler((req, res) => controlador(req, res, repo));

  router.post("/analizar", conRepo(analizar));
  router.post("/chat", conRepo(chat));
  router.get("/historial", conRepo(historial));
  router.post("/analizar-proyecto", upload.array("archivos"), conRepo(analizarProyectoIA));
  router.get("/historial/:id", conRepo(obtenerConversacion));
  router.delete("/eliminar/:id", conRepo(eliminarConversacion));

  return router;
}
