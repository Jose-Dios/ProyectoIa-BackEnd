// Ordena los archivos para analizar primero los más relevantes: los largos y
// los que concentran más ramas de decisión.
//
// El límite de palabra (\b) es necesario: sin él, "notify" cuenta como un `if`
// y "format" como un `for`, inflando la prioridad de archivos triviales.
const PALABRAS_DECISION = /\b(if|for|while|switch|catch)\b/g;

export function prioridadArchivo(archivo) {
  const contenido = archivo.contenido;

  const lineas = contenido.split("\n").length;
  const complejidad = (contenido.match(PALABRAS_DECISION) ?? []).length;

  return lineas + complejidad * 10;
}
