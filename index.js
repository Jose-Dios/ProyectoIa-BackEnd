import "dotenv/config";
import express from "express";
import cors from "cors";
import { conectarDB } from "./db/mongo.js";
import crearRouterAnalisis from "./routes/routes_analize.js";

const app = express();


app.use(cors());
app.use(express.json());
app.use("/refactorizado", express.static("refactorizado"));

const PORT = process.env.PORT;

async function iniciarServidor() {
  try {
    const db = await conectarDB();

    app.use("/api", crearRouterAnalisis(db));

    app.listen(PORT, () => {
      console.log(`Backend escuchando en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
  }
}

iniciarServidor();
