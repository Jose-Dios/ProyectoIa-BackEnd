import express from "express";
import cors from "cors";
import multer from "multer";
import { conectarDB, cerrarDB } from "./db/repositorio.js";
import crearRouterAnalisis from "./routes/routes_analize.js";
import { CARPETA_PUBLICA } from "./utils/crearZip.js";
import { HttpError } from "./utils/errores.js";
import { config } from "./config/env.js";

// Middleware central de errores: traduce el error a un código HTTP y evita
// filtrar detalles internos al cliente. Debe declararse tras las rutas.
function manejadorErrores(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.estado).json({ error: error.message });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: `Error al subir archivos: ${error.message}` });
  }

  console.error(error);

  res.status(500).json({ error: "Error interno del servidor" });
}

export async function iniciarServidor() {
  const app = express();

  app.use(cors(config.corsOrigenes.length > 0 ? { origin: config.corsOrigenes } : {}));
  app.use(express.json({ limit: "5mb" }));
  app.use(`/${CARPETA_PUBLICA}`, express.static(CARPETA_PUBLICA));

  const repo = await conectarDB();

  app.get("/salud", (req, res) =>
    res.json({ estado: "ok", modelo: config.ollama.modelo, persistencia: repo.tipo })
  );

  app.use("/api", crearRouterAnalisis(repo));
  app.use(manejadorErrores);

  const servidor = app.listen(config.puerto, () => {
    console.log(`Backend escuchando en http://localhost:${config.puerto}`);
  });

  const apagar = async (senial) => {
    console.log(`\n${senial} recibido, cerrando servidor...`);

    servidor.close();
    await cerrarDB();
    process.exit(0);
  };

  process.on("SIGINT", () => apagar("SIGINT"));
  process.on("SIGTERM", () => apagar("SIGTERM"));

  return servidor;
}
