import fs from "fs";
import path from "path";
import {
  crearEspacioTrabajo,
  guardarArchivosRefactorizados,
  crearReporteCambios,
  crearReporteArquitectura,
  crearZip,
  limpiarEspacioTrabajo,
  CARPETA_PUBLICA,
} from "../utils/crearZip.js";
import { validarSintaxis } from "../services/validarCodigo.js";
import { calcularMetricasCodigo, compararMetricas } from "../utils/metricasCodigo.js";
import { prioridadArchivo } from "../utils/prioridadArchivo.js";
import { normalizarResumen, validarFormato, extraerMetricasFinales } from "../utils/metricas.js";

// aiService.js carga config/env.js al importarse, que exige estas variables.
// Se importa de forma dinámica porque los `import` estáticos se evalúan antes
// que el cuerpo del módulo, y entonces las variables aún no estarían puestas.
process.env.OLLAMA ??= "http://127.0.0.1:11434/api/chat";
process.env.MODELO ??= "qwen2.5-coder:3b";
process.env.BD_MODO ??= "memoria";

const { limpiarBloqueDeCodigo } = await import("../services/aiService.js");

let fallos = 0;
const ok = (n, c) => {
  if (!c) fallos++;
  console.log(`${c ? "PASA " : "FALLA"}  ${n}`);
};

// ---------- 1. ZIP end-to-end ----------
const espacio = crearEspacioTrabajo();

guardarArchivosRefactorizados(
  [
    { archivo: "src/index.js", codigo: "export const a = 1;\n" },
    { archivo: "test/index.js", codigo: "export const b = 2;\n" },
    { archivo: "README.md", codigo: "# proyecto del usuario\n" },
  ],
  espacio
);

ok(
  "sin colision de basename (src/index.js y test/index.js coexisten)",
  fs.existsSync(path.join(espacio.codigo, "src", "index.js")) &&
    fs.existsSync(path.join(espacio.codigo, "test", "index.js"))
);

// La ruta maliciosa se neutraliza y aterriza DENTRO del espacio de trabajo.
guardarArchivosRefactorizados([{ archivo: "../../evil.js", codigo: "x" }], espacio);
const escapo = fs.existsSync(path.resolve(espacio.base, "..", "..", "evil.js")) || fs.existsSync("evil.js");
ok("zip slip neutralizado: no escribe fuera del espacio", !escapo);
ok("zip slip: el archivo queda contenido dentro", fs.existsSync(path.join(espacio.codigo, "evil.js")));

// Ruta absoluta de Windows tambien contenida
guardarArchivosRefactorizados([{ archivo: "C:\\Windows\\hack.js", codigo: "x" }], espacio);
ok("ruta absoluta neutralizada", fs.existsSync(path.join(espacio.codigo, "Windows", "hack.js")));

crearReporteCambios([{ grupo: ["src/index.js", "test/index.js"], resultado: "analisis" }], espacio);
crearReporteArquitectura("# REPORTE\n", espacio);

const reporte = fs.readFileSync(path.join(espacio.reportes, "CAMBIOS_IA.md"), "utf-8");
ok("reporte nombra los archivos reales", !reporte.includes("desconocido") && reporte.includes("src/index.js"));

const nombreZip = await crearZip(espacio);
const rutaZip = path.join(CARPETA_PUBLICA, nombreZip);
ok("ZIP creado aunque la carpeta publica no existia", fs.existsSync(rutaZip) && fs.statSync(rutaZip).size > 0);

limpiarEspacioTrabajo(espacio);
ok("espacio temporal limpiado", !fs.existsSync(espacio.base));
fs.rmSync(CARPETA_PUBLICA, { recursive: true, force: true });

// ---------- 2. Validacion de sintaxis ----------
ok("codigo ESM valido pasa", (await validarSintaxis("a.js", "import x from 'y';\nexport const a=1;")).valido);
ok("codigo CJS valido pasa", (await validarSintaxis("a.js", "const a = require('b');\nmodule.exports = a;")).valido);

const roto = await validarSintaxis("a.js", "function f( {\n  return 1;\n");
ok("codigo roto detectado", roto.valido === false && typeof roto.motivo === "string" && roto.motivo.length > 0);

const ts = await validarSintaxis("a.ts", "const a: number = 1;");
ok("archivo .ts se omite de la validacion", ts.valido === true && ts.validado === false);

// ---------- 2b. Limpieza de la salida del modelo (casos reales de mistral:7b) ----------
ok("texto sin fences se devuelve tal cual", limpiarBloqueDeCodigo("const a = 1;") === "const a = 1;");

ok(
  "respuesta que es solo un bloque markdown",
  limpiarBloqueDeCodigo("```javascript\nconst a = 1;\n```") === "const a = 1;"
);

ok(
  "prosa ANTES y DESPUES del bloque (caso real mistral)",
  limpiarBloqueDeCodigo(
    "A continuacion se presenta el archivo refactorizado:\n\n```javascript\nconst a = 1;\n```\n\nEn este refactorizado se ha mejorado la legibilidad."
  ) === "const a = 1;"
);

ok(
  "varios bloques: se elige el mas largo",
  limpiarBloqueDeCodigo("```js\nconst a=1;\n```\ntexto\n```js\nconst a = 1;\nconst b = 2;\n```") ===
    "const a = 1;\nconst b = 2;"
);

ok(
  "bloque abierto sin cerrar (salida truncada)",
  limpiarBloqueDeCodigo("Aqui tienes:\n```javascript\nconst a = 1;\nconst b = 2;") ===
    "const a = 1;\nconst b = 2;"
);

const salidaReal = [
  "A continuacion se presenta el archivo `usuarios.js` refactorizado:",
  "",
  "```javascript",
  "let lista = [];",
  "function agregarUsuario(nombre) {",
  "  lista.push({ nombre });",
  "}",
  "module.exports = { agregarUsuario };",
  "```",
  "",
  "En este refactorizado se han mejorado la legibilidad y el formato del codigo.",
].join("\n");

ok(
  "la salida real de mistral compila despues de limpiarla",
  (await validarSintaxis("u.js", limpiarBloqueDeCodigo(salidaReal))).valido
);

ok(
  "sin limpiar, esa misma salida NO compila (guarda contra regresion)",
  (await validarSintaxis("u.js", salidaReal)).valido === false
);

// ---------- 2c. Contrato del modulo (deriva semantica) ----------
const { extraerExportaciones, extraerRutas, validarContrato } = await import(
  "../services/validarContrato.js"
);

const exp = (c) => [...extraerExportaciones(c)].sort();

ok("CJS: module.exports = { a, b }", JSON.stringify(exp("module.exports = { a, b };")) === '["a","b"]');
ok("CJS: module.exports = { publico: interno }", JSON.stringify(exp("module.exports = { publico: interno };")) === '["publico"]');
ok("CJS: module.exports = fn -> default", JSON.stringify(exp("module.exports = calcular;")) === '["default"]');
ok("CJS: exports.foo =", JSON.stringify(exp("exports.foo = 1;")) === '["foo"]');
ok("ESM: export function", JSON.stringify(exp("export function saludar() {}")) === '["saludar"]');
ok("ESM: export const", JSON.stringify(exp("export const a = 1;")) === '["a"]');
ok("ESM: export { a as b } -> nombre publico b", JSON.stringify(exp("export { a as b };")) === '["b"]');
ok("ESM: export default", JSON.stringify(exp("export default function () {}")) === '["default"]');

// El escaner no debe confundirse con cadenas ni comentarios.
ok(
  "no detecta exportaciones dentro de comentarios",
  exp("// module.exports = { falso };\nmodule.exports = { real };").join() === "real"
);
ok(
  "no detecta exportaciones dentro de cadenas",
  exp('const s = "module.exports = { falso }";\nmodule.exports = { real };').join() === "real"
);
ok(
  "una URL http:// no se toma por comentario",
  extraerRutas('const u = "http://x.com"; app.get("/hola", h);').has("/hola")
);

ok("extraerRutas ignora cadenas que no son rutas", !extraerRutas('const m = "sin nombre";').size);

// El caso REAL de mistral: renombro agregarUsuario -> addUser. Compila, pero rompe.
const originalCjs = "function agregarUsuario(n) {}\nmodule.exports = { agregarUsuario };";
const derivado = "function addUser(n) {}\nmodule.exports = { addUser };";

const contratoRoto = validarContrato(originalCjs, derivado);
ok("deriva semantica detectada (agregarUsuario -> addUser)", contratoRoto.valido === false);
ok("nombra la exportacion perdida", contratoRoto.exportacionesPerdidas.join() === "agregarUsuario");
ok("el codigo derivado SI compila (por eso node --check no basta)", (await validarSintaxis("u.js", derivado)).valido);

const refactorHonesto = "// comentario\nfunction agregarUsuario(nombre) {\n  return nombre;\n}\nmodule.exports = { agregarUsuario };";
ok("un refactor que preserva el contrato pasa", validarContrato(originalCjs, refactorHonesto).valido);

ok(
  "anadir exportaciones nuevas no rompe el contrato",
  validarContrato(originalCjs, "function agregarUsuario(){}\nfunction extra(){}\nmodule.exports = { agregarUsuario, extra };").valido
);

// Rutas HTTP
const apiOriginal = 'app.get("/hola", h); app.post("/api/login", l);';
ok("ruta HTTP eliminada rompe el contrato", validarContrato(apiOriginal, 'app.get("/hola", h);').valido === false);
ok(
  "ruta HTTP renombrada se reporta",
  validarContrato(apiOriginal, 'app.get("/hello", h); app.post("/api/login", l);').rutasPerdidas.join() === "/hola"
);
ok("mismas rutas -> contrato intacto", validarContrato(apiOriginal, 'app.post("/api/login", l);\napp.get("/hola", h);').valido);

// ---------- 3. Metricas objetivas ----------
const antes = [
  { nombre: "a.js", contenido: "var x = 1;\nif (x == 1) { console.log('hola'); }\nfunction notify() { return 1; }\n" },
];
const despues = [
  { nombre: "a.js", contenido: "const x = 1;\n// comentario\nif (x === 1) { registrar('hola'); }\nfunction notify() { return 1; }\n" },
];

const mAntes = calcularMetricasCodigo(antes);
const mDespues = calcularMetricasCodigo(despues);

ok("malas practicas detectadas antes (var, ==, console.log)", mAntes.malasPracticas === 3);
ok("malas practicas eliminadas despues", mDespues.malasPracticas === 0);
ok(
  "complejidad no infla por 'notify' (bug del \\b)",
  mAntes.complejidadTotal === 2,
  `complejidad=${mAntes.complejidadTotal}`
);

const comp = compararMetricas(mAntes, mDespues);
ok("comparacion reporta mejora en malas practicas", comp.malasPracticas.mejoraPorcentual === 100);
ok("mejoraPromedio es numero finito", Number.isFinite(comp.mejoraPromedio));
ok("metricas de proyecto vacio no dan NaN", Number.isFinite(compararMetricas(calcularMetricasCodigo([]), calcularMetricasCodigo([])).mejoraPromedio));

// duplicacion
const dup = calcularMetricasCodigo([
  { nombre: "a.js", contenido: "a()\nb()\nc()\nd()\ne()\n" },
  { nombre: "b.js", contenido: "a()\nb()\nc()\nd()\ne()\n" },
]);
ok("duplicacion detectada entre archivos identicos", dup.porcentajeDuplicacion === 100);

// ---------- 4. prioridadArchivo ----------
const p = prioridadArchivo({ contenido: "notify(); format();\n" });
ok("prioridadArchivo no cuenta 'if' dentro de 'notify'", p === 2, `prioridad=${p}`);

// ---------- 5. Metricas del resumen IA ----------
const resumenIA = normalizarResumen(`
## arquitectura
SEVERIDAD: Alta
## Duplicacion de Codigo
## complejidad
## organizacion
## Buenas practicas
Arquitectura: 65%
Duplicación de código: 40%
Complejidad: 55%
Organización: 70%
Buenas prácticas: 80%
`);
ok("validarFormato acepta encabezados sin tilde", validarFormato(resumenIA));
const met = extraerMetricasFinales(resumenIA);
ok("extraerMetricasFinales lee los 5 porcentajes", met.arquitectura === 65 && met.duplicacion === 40 && met.buenasPracticas === 80);

console.log(fallos === 0 ? "\nTODO PASA" : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
