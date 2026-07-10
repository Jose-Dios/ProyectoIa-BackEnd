import "dotenv/config";

// Valida la configuración al arrancar: es preferible fallar de inmediato
// con un mensaje claro que descubrir un `undefined` a mitad de una petición.
function requerido(nombre) {
  const valor = process.env[nombre];

  if (!valor || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno obligatoria: ${nombre}. Revisa tu archivo .env (ver .env.example).`
    );
  }

  return valor.trim();
}

function numero(nombre, porDefecto, { permitirCero = false } = {}) {
  const valor = process.env[nombre];

  if (valor === undefined || valor.trim() === "") return porDefecto;

  const parsed = Number(valor);
  const valido = Number.isFinite(parsed) && (permitirCero ? parsed >= 0 : parsed > 0);

  if (!valido) {
    throw new Error(`La variable ${nombre} debe ser un número positivo. Valor recibido: "${valor}"`);
  }

  return parsed;
}

function booleano(nombre, porDefecto) {
  const valor = process.env[nombre]?.trim().toLowerCase();

  if (valor === undefined || valor === "") return porDefecto;

  return valor === "true" || valor === "1";
}

const OLLAMA_URL = requerido("OLLAMA");

const MODOS_BD = ["mongo", "memoria"];
const BD_MODO = (process.env.BD_MODO?.trim().toLowerCase() || "mongo");

if (!MODOS_BD.includes(BD_MODO)) {
  throw new Error(`BD_MODO debe ser uno de: ${MODOS_BD.join(", ")}. Valor recibido: "${BD_MODO}"`);
}

export const config = {
  puerto: numero("PORT", 3000),

  bd: {
    modo: BD_MODO,
    // BD_LINK solo hace falta si realmente se va a conectar a MongoDB.
    link: BD_MODO === "mongo" ? requerido("BD_LINK") : null,
  },

  ollama: {
    url: OLLAMA_URL,
    // Ollama descarga el modelo de memoria con keep_alive: 0 sobre su propio
    // endpoint, así que PAUSA solo es necesaria si se usa una URL distinta.
    urlPausa: process.env.PAUSA?.trim() || OLLAMA_URL,
    modelo: requerido("MODELO"),
    // Un modelo local puede tardar bastante en un archivo grande.
    timeoutMs: numero("OLLAMA_TIMEOUT_MS", 300_000),
    // Cada cuántas llamadas se descarga el modelo para liberar memoria.
    llamadasAntesDeReiniciar: numero("LLAMADAS_ANTES_DE_REINICIAR", 6),

    // Reproducibilidad: con temperatura baja y semilla fija, el modelo
    // devuelve la misma salida ante el mismo prompt. Imprescindible para que
    // los resultados de un experimento sean replicables.
    opciones: {
      temperature: numero("TEMPERATURA", 0.1, { permitirCero: true }),
      seed: numero("SEED", 42, { permitirCero: true }),
      num_ctx: numero("NUM_CTX", 8192),
    },
  },

  analisis: {
    maxArchivos: numero("MAX_ARCHIVOS", 10),
    maxBytesPorArchivo: numero("MAX_BYTES_POR_ARCHIVO", 50_000),
    // Archivos por encima de este tamaño no se refactorizan: truncarlos
    // produciría código cortado a la mitad en el ZIP de salida.
    maxCaracteresRefactor: numero("MAX_CARACTERES_REFACTOR", 12_000),
    tamanioGrupo: numero("TAMANIO_GRUPO", 3),
    // Un modelo pequeño (3B) devuelve código sintácticamente inválido con
    // cierta frecuencia. Sin esta comprobación, el ZIP entregado al usuario
    // puede contener archivos que ni siquiera parsean.
    validarSintaxis: booleano("VALIDAR_SINTAXIS", true),
    // Que compile no basta: el modelo renombra funciones exportadas y rompe a
    // quien las importa. Comprueba que el contrato del módulo se mantenga.
    validarContrato: booleano("VALIDAR_CONTRATO", true),
  },

  // Orígenes permitidos para CORS, separados por coma. Vacío = permitir todo.
  corsOrigenes:
    process.env.CORS_ORIGENES?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [],

  urlPublica: process.env.URL_PUBLICA?.trim() || `http://localhost:${numero("PORT", 3000)}`,
};
