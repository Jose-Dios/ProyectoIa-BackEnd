//Esta funcion analiza las lineas de codigo de los archivos dandole prioridad a las que tengan mayor contenido
export function prioridadArchivo(archivo) {

  const contenido = archivo.contenido;

  const lineas = contenido.split("\n").length;

  const complejidad = (contenido.match(/if|for|while|switch|catch/g) || []).length;

  return lineas + complejidad * 10;

}