import fs from "fs";
import path from "path";

//DEPRECATED : Esta funcion recibe una ruta, recorre la carpeta, identifica los archivos y los devuelve para su analisis
export function leerProyecto(rutaProyecto) {

  const archivos = [];
  const estructura = [];

  const carpetasIgnoradas = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage"
  ];

  function recorrer(carpeta, nivel = 0) {

    const items = fs.readdirSync(carpeta);

    for (const item of items) {

      const ruta = path.join(carpeta, item);
      const stat = fs.statSync(ruta);

      if (stat.isDirectory()) {

        // ignorar carpetas innecesarias
        if (carpetasIgnoradas.includes(item)) {
          continue;
        }

        estructura.push("  ".repeat(nivel) + item + "/");

        recorrer(ruta, nivel + 1);

      } else {

        if (
          stat.size < 50000 &&
          (
            item.endsWith(".js") ||
            item.endsWith(".ts") ||
            item.endsWith(".py") ||
            item.endsWith(".java")
          )
        ) {

          const contenido = fs.readFileSync(ruta, "utf8");

          archivos.push({
            nombre: ruta,
            contenido
          });

        }
      }
    }
  }

  recorrer(rutaProyecto);

  return {
    archivos,
    estructura
  };
}