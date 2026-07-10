// Prueba end-to-end REAL contra Ollama. Requiere `ollama serve` y el modelo
// descargado. Mide la tasa de exito del modelo y las metricas antes/despues.
//
//   node tests/e2e.ollama.mjs [modelo]
//
// No requiere MongoDB: usa el modo memoria.

process.env.BD_MODO = "memoria";
process.env.PORT = "3988";
process.env.URL_PUBLICA = "http://localhost:3988";
// 127.0.0.1 y no "localhost": Ollama solo escucha en IPv4.
process.env.OLLAMA = process.env.OLLAMA ?? "http://127.0.0.1:11434/api/chat";
process.env.MODELO = process.argv[2] ?? process.env.MODELO ?? "qwen2.5-coder:3b";
process.env.OLLAMA_TIMEOUT_MS = "600000";
process.env.MAX_ARCHIVOS = process.env.MAX_ARCHIVOS ?? "4";
process.env.TAMANIO_GRUPO = process.env.TAMANIO_GRUPO ?? "2";

const { iniciarServidor } = await import("../servidor.js");
const servidor = await iniciarServidor();

const BASE = "http://localhost:3988";

// Proyecto de prueba con defectos deliberados: `var`, `==`, console.log,
// duplicacion literal entre carpetas y complejidad anidada.
const PROYECTO = {
  "src/usuarios.js": `var lista = [];
function agregarUsuario(nombre, edad) {
  if (nombre == null) { console.log("sin nombre"); return; }
  if (edad == undefined) { console.log("sin edad"); return; }
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].nombre == nombre) { console.log("duplicado"); return; }
  }
  lista.push({ nombre: nombre, edad: edad });
}
module.exports = { agregarUsuario };
`,
  "src/productos.js": `var lista = [];
function agregarProducto(nombre, precio) {
  if (nombre == null) { console.log("sin nombre"); return; }
  if (precio == undefined) { console.log("sin precio"); return; }
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].nombre == nombre) { console.log("duplicado"); return; }
  }
  lista.push({ nombre: nombre, precio: precio });
}
module.exports = { agregarProducto };
`,
  "src/calculo.js": `function calcular(a, b, op) {
  var r = 0;
  if (op == "suma") { r = a + b; }
  else if (op == "resta") { r = a - b; }
  else if (op == "mult") { r = a * b; }
  else if (op == "div") { if (b == 0) { console.log("div por cero"); r = 0; } else { r = a / b; } }
  console.log("resultado", r);
  return r;
}
module.exports = calcular;
`,
  "src/api.js": `var http = require("http");
function iniciar(puerto) {
  var servidor = http.createServer(function (req, res) {
    if (req.url == "/hola") { res.end("hola"); }
    else if (req.url == "/adios") { res.end("adios"); }
    else { res.statusCode = 404; res.end("no encontrado"); }
  });
  servidor.listen(puerto, function () { console.log("escuchando"); });
  return servidor;
}
module.exports = { iniciar };
`,
};

const formulario = new FormData();
formulario.append("lenguaje", "javascript");

for (const [nombre, contenido] of Object.entries(PROYECTO)) {
  formulario.append("archivos", new Blob([contenido], { type: "text/plain" }), nombre);
}

console.log(`\nModelo: ${process.env.MODELO}`);
console.log(`Archivos enviados: ${Object.keys(PROYECTO).length}\n`);
console.log("Analizando (esto tarda varios minutos con un modelo local)...\n");

const inicio = Date.now();
const respuesta = await fetch(`${BASE}/api/analizar-proyecto`, { method: "POST", body: formulario });
const cuerpo = await respuesta.json();
const transcurrido = ((Date.now() - inicio) / 1000).toFixed(1);

if (respuesta.status !== 200) {
  console.error(`FALLO HTTP ${respuesta.status}:`, cuerpo);
  servidor.close();
  process.exit(1);
}

const { validacion, metricasAntes, metricasDespues, comparacion, zip, modelo } = cuerpo;

console.log("=".repeat(64));
console.log(`VALIDACION SINTACTICA (modelo: ${modelo})`);
console.log("=".repeat(64));
console.log(`  Archivos procesados............ ${validacion.total}`);
console.log(`  Validos al primer intento..... ${validacion.validosPrimerIntento}`);
console.log(`  Reparados (total)............. ${validacion.reparadosTrasError}`);
console.log(`     por sintaxis............... ${validacion.reparadosPorSintaxis}`);
console.log(`     por contrato roto......... ${validacion.reparadosPorContrato}`);
console.log(`  Revertidos (total)........... ${validacion.revertidos}`);
console.log(`     por sintaxis.............. ${validacion.revertidosPorSintaxis}`);
console.log(`     por contrato roto........ ${validacion.revertidosPorContrato}`);
console.log(`  Omitidos por tamanio......... ${validacion.omitidosPorTamanio}`);
console.log(`  TASA DE EXITO................ ${validacion.tasaExito}%`);

for (const r of validacion.archivosRevertidos) {
  console.log(`    - revertido: ${r.archivo} (${r.estado})`);
  console.log(`      motivo: ${String(r.error).slice(0, 140)}`);
}

console.log("\n" + "=".repeat(64));
console.log("METRICAS OBJETIVAS (deterministas, antes vs despues)");
console.log("=".repeat(64));

const fila = (etiqueta, clave) => {
  const c = comparacion[clave];
  const signo = c.mejoraPorcentual > 0 ? "+" : "";
  console.log(
    `  ${etiqueta.padEnd(30)} ${String(c.antes).padStart(8)} -> ${String(c.despues).padStart(8)}   ${signo}${c.mejoraPorcentual}%`
  );
};

fila("Lineas de codigo", "lineasCodigo");
fila("Complejidad ciclomatica", "complejidadTotal");
fila("Complejidad por funcion", "complejidadPromedioPorFuncion");
fila("Duplicacion (%)", "porcentajeDuplicacion");
fila("Malas practicas (var/==/log)", "malasPracticas");
console.log(
  `  ${"Densidad comentarios (%)".padEnd(30)} ${String(metricasAntes.densidadComentarios).padStart(8)} -> ${String(metricasDespues.densidadComentarios).padStart(8)}`
);
console.log(`\n  MEJORA PROMEDIO: ${comparacion.mejoraPromedio}%`);

console.log(`\nTiempo total: ${transcurrido}s`);
console.log(`ZIP: ${zip}`);

// El ZIP debe ser descargable y no vacio.
const zipRes = await fetch(zip);
const bytes = (await zipRes.arrayBuffer()).byteLength;
console.log(`Descarga del ZIP: HTTP ${zipRes.status}, ${bytes} bytes`);

servidor.close();
process.exit(0);
