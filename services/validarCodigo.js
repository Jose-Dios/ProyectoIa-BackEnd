import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const ejecutar = promisify(execFile);

const EXTENSIONES_VALIDABLES = new Set([".js", ".mjs", ".cjs"]);

// Un modelo de 3B parámetros produce código sintácticamente inválido con cierta
// frecuencia: cierra mal las llaves, corta la salida, inventa tokens. Entregar
// ese código al usuario sin comprobarlo hace inservible la refactorización.
//
// Validamos con el propio parser de Node (`node --check`), que no requiere
// dependencias externas y es exactamente el mismo motor que ejecutará el código.
export async function validarSintaxis(nombreArchivo, codigo) {
  const extension = path.extname(nombreArchivo).toLowerCase();

  if (!EXTENSIONES_VALIDABLES.has(extension)) {
    return { valido: true, validado: false, motivo: `Extensión ${extension || "desconocida"} no validable` };
  }

  // `node --check` interpreta .js como CommonJS: un archivo con `import`
  // fallaría por el modo, no por la sintaxis. La extensión .mjs lo evita.
  const esModulo = /^\s*(import|export)\s/m.test(codigo);
  const extensionTemporal = esModulo ? ".mjs" : ".cjs";

  const rutaTemporal = path.join(
    os.tmpdir(),
    `validacion_${crypto.randomUUID()}${extensionTemporal}`
  );

  try {
    await fs.writeFile(rutaTemporal, codigo, "utf-8");
    await ejecutar(process.execPath, ["--check", rutaTemporal], { timeout: 10_000 });

    return { valido: true, validado: true };
  } catch (error) {
    // execFile rechaza con el stderr del parser cuando el código no compila.
    const detalle = (error.stderr || error.message || "").split("\n").slice(0, 4).join(" ").trim();

    return { valido: false, validado: true, motivo: detalle };
  } finally {
    await fs.rm(rutaTemporal, { force: true }).catch(() => {});
  }
}
