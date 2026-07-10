import { crearRepositorioMongo } from "./repositorioMongo.js";
import { crearRepositorioMemoria } from "./repositorioMemoria.js";
import { config } from "../config/env.js";

let repositorio = null;

// El backend de persistencia se elige con BD_MODO. Ambas implementaciones
// exponen la misma interfaz, así que los controladores no saben cuál usan.
export async function conectarDB() {
  if (repositorio) return repositorio;

  if (config.bd.modo === "memoria") {
    console.log("Persistencia EN MEMORIA: los datos se pierden al reiniciar.");
    repositorio = crearRepositorioMemoria();
  } else {
    repositorio = await crearRepositorioMongo(config.bd.link);
  }

  return repositorio;
}

export async function cerrarDB() {
  if (!repositorio) return;

  await repositorio.cerrar();
  repositorio = null;
}
