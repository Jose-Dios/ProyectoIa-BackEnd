import crypto from "crypto";

//Esta funcion es invocada para detectar archivos duplicados y no realizar un analisis 2 veces de forma innecesaria
export function detectarDuplicados(archivos) {

  const mapa = new Map();
  const duplicados = [];

  for (const archivo of archivos) {

    const hash = crypto
      .createHash("md5")
      .update(archivo.contenido)
      .digest("hex");

    if (mapa.has(hash)) {

      duplicados.push({
        original: mapa.get(hash),
        duplicado: archivo.nombre
      });

    } else {

      mapa.set(hash, archivo.nombre);

    }

  }

  return duplicados;

}

//Esta funcion elimina los duplicados devolviendo un arcchivo unico
export function eliminarDuplicados(archivos) {

  const mapa = new Map();
  const unicos = [];

  for (const archivo of archivos) {

    const hash = crypto
      .createHash("md5")
      .update(archivo.contenido)
      .digest("hex");

    if (!mapa.has(hash)) {

      mapa.set(hash, true);
      unicos.push(archivo);

    }

  }

  return unicos;

}