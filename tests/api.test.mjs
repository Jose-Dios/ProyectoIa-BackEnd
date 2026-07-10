// Prueba end-to-end del servidor en modo memoria. No requiere Mongo ni Ollama.
process.env.BD_MODO = "memoria";
process.env.PORT = "3987";
process.env.OLLAMA = "http://localhost:11434/api/chat";
process.env.MODELO = "qwen2.5-coder:3b";
process.env.URL_PUBLICA = "http://localhost:3987";

const { iniciarServidor } = await import("../servidor.js");
const servidor = await iniciarServidor();

const BASE = "http://localhost:3987";
let fallos = 0;
const ok = (n, c, extra = "") => {
  if (!c) fallos++;
  console.log(`${c ? "PASA " : "FALLA"}  ${n}${extra ? ` (${extra})` : ""}`);
};

const pedir = async (metodo, ruta, cuerpo) => {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await res.text();

  return { estado: res.status, cuerpo: texto ? JSON.parse(texto) : null };
};

// salud
const salud = await pedir("GET", "/salud");
ok("GET /salud responde 200 y reporta persistencia=memoria", salud.estado === 200 && salud.cuerpo.persistencia === "memoria");

// historial vacio
const vacio = await pedir("GET", "/api/historial");
ok("GET /api/historial devuelve lista vacia", vacio.estado === 200 && Array.isArray(vacio.cuerpo) && vacio.cuerpo.length === 0);

// validaciones 400 (antes eran 500)
const sinCodigo = await pedir("POST", "/api/analizar", {});
ok("POST /api/analizar sin codigo -> 400", sinCodigo.estado === 400, `estado=${sinCodigo.estado}`);

const idMalo = await pedir("GET", "/api/historial/no-es-un-id");
ok("GET /api/historial/:id invalido -> 400", idMalo.estado === 400, `estado=${idMalo.estado}`);

const borrarMalo = await pedir("DELETE", "/api/eliminar/xxx");
ok("DELETE /api/eliminar/:id invalido -> 400", borrarMalo.estado === 400, `estado=${borrarMalo.estado}`);

const chatVacio = await pedir("POST", "/api/chat", { mensaje: "  ", conversacionId: "x" });
ok("POST /api/chat con mensaje vacio -> 400", chatVacio.estado === 400, `estado=${chatVacio.estado}`);

const sinArchivos = await pedir("POST", "/api/analizar-proyecto");
ok("POST /api/analizar-proyecto sin archivos -> 400", sinArchivos.estado === 400, `estado=${sinArchivos.estado}`);

// 404 con id valido pero inexistente
const idValidoInexistente = "11111111-2222-3333-4444-555555555555";
const noEncontrado = await pedir("GET", `/api/historial/${idValidoInexistente}`);
ok("GET /api/historial/:id valido inexistente -> 404", noEncontrado.estado === 404, `estado=${noEncontrado.estado}`);

// CRUD directo contra el repositorio en memoria
const { conectarDB } = await import("../db/repositorio.js");
const repo = await conectarDB();

const id = await repo.crear({ tipo: "test", fecha: new Date(), mensajes: [], eliminado: false });
ok("repo.crear devuelve id valido", repo.esIdValido(id));

await repo.agregarMensajes(id, [{ role: "user", content: "hola" }]);
const doc = await repo.obtenerPorId(id);
ok("repo.agregarMensajes persiste el mensaje", doc.mensajes.length === 1 && doc.mensajes[0].content === "hola");

// copia defensiva: mutar el resultado no debe afectar al repositorio
doc.mensajes.push({ role: "user", content: "inyectado" });
const doc2 = await repo.obtenerPorId(id);
ok("obtenerPorId devuelve copia defensiva", doc2.mensajes.length === 1);

const lista = await repo.listarRecientes(20);
ok("repo.listarRecientes ve la conversacion", lista.length === 1);

ok("repo.marcarEliminada funciona la primera vez", (await repo.marcarEliminada(id)) === true);
ok("repo.marcarEliminada es idempotente (2a vez false)", (await repo.marcarEliminada(id)) === false);
ok("conversacion eliminada no aparece en historial", (await repo.listarRecientes(20)).length === 0);
ok("conversacion eliminada no se obtiene por id", (await repo.obtenerPorId(id)) === null);

const borrar404 = await pedir("DELETE", `/api/eliminar/${id}`);
ok("DELETE de conversacion ya eliminada -> 404", borrar404.estado === 404, `estado=${borrar404.estado}`);

servidor.close();
console.log(fallos === 0 ? "\nTODO PASA" : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
