import fs from "fs";
import path from "path";
import crypto from "crypto";
import archiver from "archiver";

export const CARPETA_PUBLICA = "refactorizado";

const CARPETA_TEMPORAL_BASE = "refactorizado_temp";

// Cada petición trabaja en su propia carpeta: con una ruta fija, dos análisis
// simultáneos se sobrescribían los archivos entre sí. El código y los reportes
// van separados para no mezclar los .md generados con los del proyecto.
export function crearEspacioTrabajo() {
  const base = path.join(CARPETA_TEMPORAL_BASE, crypto.randomUUID());

  const espacio = {
    base,
    codigo: path.join(base, "codigo"),
    reportes: path.join(base, "reportes"),
  };

  fs.mkdirSync(espacio.codigo, { recursive: true });
  fs.mkdirSync(espacio.reportes, { recursive: true });

  return espacio;
}

// Impide que una ruta como "../../etc/passwd" (zip slip) escriba fuera del
// espacio de trabajo, y conserva la jerarquía original de carpetas.
function rutaSegura(carpetaBase, nombreArchivo) {
  const relativa = path
    .normalize(nombreArchivo)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^([A-Za-z]:)?[/\\]+/, "");

  const destino = path.resolve(carpetaBase, relativa);
  const raiz = path.resolve(carpetaBase);

  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
    throw new Error(`Ruta de archivo no permitida: ${nombreArchivo}`);
  }

  return destino;
}

export function guardarArchivosRefactorizados(archivos, espacio) {
  for (const archivo of archivos) {
    const ruta = rutaSegura(espacio.codigo, archivo.archivo);

    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, archivo.codigo);
  }
}

export function crearReporteCambios(analisisArchivos, espacio) {
  let contenido = "# Cambios realizados por la IA\n\n";

  for (const analisis of analisisArchivos) {
    // `analizarProyecto` devuelve { grupo, resultado }: el análisis es por
    // grupo de archivos, no por archivo individual.
    const archivos = analisis.grupo?.join(", ") ?? "archivo desconocido";

    contenido += `## Archivos: ${archivos}\n\n`;

    if (analisis.resultado) {
      contenido += `${analisis.resultado}\n\n`;
    }

    contenido += "---\n\n";
  }

  fs.writeFileSync(path.join(espacio.reportes, "CAMBIOS_IA.md"), contenido);
}

export function crearReporteArquitectura(resumen, espacio) {
  fs.writeFileSync(path.join(espacio.reportes, "ARQUITECTURA_SUGERIDA.md"), resumen);
}

export function crearZip(espacio) {
  return new Promise((resolver, rechazar) => {
    // La carpeta pública está en .gitignore, así que en un clon nuevo no
    // existe: sin este mkdir, createWriteStream lanza ENOENT de forma
    // asíncrona y tumba el proceso.
    fs.mkdirSync(CARPETA_PUBLICA, { recursive: true });

    // Nombre no adivinable: los ZIP se sirven como estáticos y contienen
    // código fuente del usuario.
    const nombreZip = `refactorizado_${crypto.randomUUID()}.zip`;
    const rutaZip = path.join(CARPETA_PUBLICA, nombreZip);

    const output = fs.createWriteStream(rutaZip);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolver(nombreZip));
    output.on("error", rechazar);

    archive.on("error", rechazar);
    archive.on("warning", rechazar);

    archive.pipe(output);

    archive.directory(espacio.codigo, "codigo_refactorizado");
    archive.directory(espacio.reportes, "reporte_IA");

    archive.finalize();
  });
}

export function limpiarEspacioTrabajo(espacio) {
  if (espacio?.base && fs.existsSync(espacio.base)) {
    fs.rmSync(espacio.base, { recursive: true, force: true });
  }
}
