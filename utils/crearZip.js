import fs from "fs";
import archiver from "archiver";
import path from "path";

export async function crearZip(carpetaOrigen) {

  return new Promise((resolve, reject) => {

    // nombre único del zip
    const nombreZip = `refactorizado_${Date.now()}.zip`;

    const rutaZip = path.join("refactorizado", nombreZip);

    const output = fs.createWriteStream(rutaZip);

    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    output.on("close", () => {
      resolve(nombreZip);
    });

    archive.on("error", err => {
      reject(err);
    });

    archive.pipe(output);

    // codigo refactorizado
    archive.directory(carpetaOrigen, "codigo_refactorizado");

    // reporte
    archive.file(
      path.join("refactorizado_temp", "CAMBIOS_IA.md"),
      { name: "reporte_IA/CAMBIOS_IA.md" }
    );

    archive.file(
      path.join("refactorizado_temp", "ARQUITECTURA_SUGERIDA.md"),
      { name: "reporte_IA/ARQUITECTURA_SUGERIDA.md" }
    );

    archive.finalize();

  });
}


export function guardarArchivosRefactorizados(archivos) {

  const carpeta = "refactorizado_temp";

  // limpiar carpeta si existe
  if (fs.existsSync(carpeta)) {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }

  fs.mkdirSync(carpeta);

  for (const archivo of archivos) {

    const nombre = path.basename(archivo.archivo);

    const ruta = path.join(carpeta, nombre);

    fs.writeFileSync(ruta, archivo.codigo);

  }

  return carpeta;
}

export function crearReporteCambios(archivos) {

  const ruta = path.join("refactorizado_temp", "CAMBIOS_IA.md");

  let contenido = "# Cambios realizados por la IA\n\n";

  for (const archivo of archivos) {

    const nombre = archivo.archivo
      ? path.basename(archivo.archivo)
      : archivo.nombre || "archivo_desconocido";

    contenido += `## Archivo: ${nombre}\n\n`;

    if (archivo.resultado) {
      contenido += `${archivo.resultado}\n\n`;
    }

    contenido += "---\n\n";

  }

  fs.writeFileSync(ruta, contenido);

}

export function limpiarCarpetaTemporal(){

  const carpeta = "refactorizado_temp";

  if (fs.existsSync(carpeta)) {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }

}