import axios from "axios";
import { config } from "../config/env.js";

const { url, urlPausa, modelo, timeoutMs, llamadasAntesDeReiniciar, opciones } = config.ollama;

let contadorLlamadas = 0;

// Un modelo local sirve una petición a la vez: lanzarlas en paralelo solo
// provoca contención de memoria. Encadenamos las llamadas en una cola para
// que dos peticiones HTTP simultáneas no compitan por la GPU ni corrompan
// el contador de reinicios.
let cola = Promise.resolve();

function encolar(tarea) {
  const resultado = cola.then(tarea, tarea);

  // La cola avanza aunque la tarea falle; el error se propaga al llamador.
  cola = resultado.then(
    () => undefined,
    () => undefined
  );

  return resultado;
}

// Descarga el modelo de memoria (keep_alive: 0) para evitar la degradación
// de respuestas que Ollama muestra tras varias generaciones seguidas.
async function reiniciarModelo() {
  try {
    console.log("Descargando modelo de memoria para liberar recursos...");

    await axios.post(
      urlPausa,
      { model: modelo, messages: [], keep_alive: 0 },
      { timeout: timeoutMs }
    );

    await new Promise((resolver) => setTimeout(resolver, 1500));
  } catch (error) {
    // No es fatal: la siguiente generación volverá a cargar el modelo.
    console.error("No se pudo reiniciar el modelo:", error.message);
  }
}

async function ejecutarLlamada(messages) {
  if (contadorLlamadas >= llamadasAntesDeReiniciar) {
    await reiniciarModelo();
    contadorLlamadas = 0;
  }

  contadorLlamadas++;

  let respuesta;

  try {
    respuesta = await axios.post(
      url,
      { model: modelo, messages, stream: false, options: opciones },
      { timeout: timeoutMs }
    );
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      // Ollama escucha solo en IPv4; Node resuelve "localhost" primero a ::1.
      const pista = url.includes("localhost") ? ' Prueba a usar "127.0.0.1" en lugar de "localhost".' : "";

      throw new Error(
        `No se pudo conectar con Ollama en ${url}. ¿Está corriendo 'ollama serve'?${pista}`
      );
    }

    if (error.code === "ECONNABORTED") {
      throw new Error(`Ollama superó el tiempo límite de ${timeoutMs} ms.`);
    }

    throw new Error(`Error al llamar a Ollama: ${error.message}`);
  }

  const contenido = respuesta.data?.message?.content;

  if (typeof contenido !== "string") {
    throw new Error("Ollama devolvió una respuesta con un formato inesperado.");
  }

  return contenido;
}

export function llamarIA({ prompt, messages }) {
  if (!messages && !prompt) {
    throw new Error("llamarIA requiere 'prompt' o 'messages'.");
  }

  const conversacion = messages ?? [{ role: "user", content: prompt }];

  return encolar(() => ejecutarLlamada(conversacion));
}
