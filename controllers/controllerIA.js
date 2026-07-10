import {
  analizarCodigo,
  chatGeneral,
  analizarProyecto,
  resumirProyecto,
  refactorizarProyecto,
  ESTADO,
} from "../services/aiService.js";
import { calcularMetricasCodigo, compararMetricas } from "../utils/metricasCodigo.js";
import {
  crearEspacioTrabajo,
  guardarArchivosRefactorizados,
  crearReporteCambios,
  crearReporteArquitectura,
  crearZip,
  limpiarEspacioTrabajo,
} from "../utils/crearZip.js";
import { prioridadArchivo } from "../utils/prioridadArchivo.js";
import { eliminarDuplicados } from "../utils/detectarDuplicados.js";
import {
  validarFormato,
  normalizarResumen,
  interpretarMejora,
  extraerMetricasFinales,
  iniciarCronometro,
  finalizarCronometro,
} from "../utils/metricas.js";
import { errorPeticion, errorNoEncontrado } from "../utils/errores.js";
import { config } from "../config/env.js";

const CARPETAS_IGNORADAS = ["node_modules", ".git", "dist", "build", "coverage"];

const RESUMEN_POR_DEFECTO = `# REPORTE DE CALIDAD DEL SOFTWARE

## Problemas detectados

### Arquitectura
SEVERIDAD: Baja

### Duplicación de Código
SEVERIDAD: Baja

### Complejidad
SEVERIDAD: Baja

### Organización
SEVERIDAD: Baja

### Buenas prácticas
SEVERIDAD: Baja

## Métricas de calidad del software

No fue posible analizar el proyecto con el formato esperado.

Arquitectura: 0%
Duplicación de código: 0%
Complejidad: 0%
Organización: 0%
Buenas prácticas: 0%
`;

// Cada controlador recibe `repo`: la implementación concreta (MongoDB o
// memoria) se decide en el arranque según BD_MODO.
function validarId(repo, id, campo = "id") {
  if (!repo.esIdValido(id)) {
    throw errorPeticion(`El ${campo} proporcionado no es válido`);
  }

  return id;
}

// Recibe código desde req.body y guarda la conversación.
export async function analizar(req, res, repo) {
  const inicio = iniciarCronometro();

  const { codigo, lenguaje } = req.body ?? {};

  if (typeof codigo !== "string" || codigo.trim() === "") {
    throw errorPeticion("Falta el código");
  }

  const resultado = await analizarCodigo({
    codigo,
    lenguaje: lenguaje || "desconocido",
  });

  const { segundos } = finalizarCronometro(inicio);
  const tiempoAnalisis = `${segundos} segundos`;

  const conversacionId = await repo.crear({
    tipo: "analisis_codigo",
    lenguaje: lenguaje || "desconocido",
    codigo,
    fecha: new Date(),
    tiempoAnalisis,
    mensajes: [
      { role: "user", content: `Analiza este código:\n${codigo}` },
      { role: "assistant", content: resultado },
    ],
    eliminado: false,
    fechaEliminado: null,
  });

  res.json({ resultado, tiempoAnalisis, conversacionId });
}

// Recupera la conversación, añade el mensaje del usuario y la respuesta de la IA.
export async function chat(req, res, repo) {
  const { mensaje, conversacionId } = req.body ?? {};

  if (typeof mensaje !== "string" || mensaje.trim() === "") {
    throw errorPeticion("Mensaje vacío");
  }

  validarId(repo, conversacionId, "conversacionId");

  const conversacion = await repo.obtenerPorId(conversacionId);

  if (!conversacion) {
    throw errorNoEncontrado("Conversación no encontrada");
  }

  const mensajeUsuario = { role: "user", content: mensaje };

  const respuesta = await chatGeneral({
    mensajes: [...conversacion.mensajes, mensajeUsuario],
  });

  // Se añaden ambos mensajes de golpe, sin reescribir el historial completo:
  // así una petición concurrente sobre la misma conversación no pierde datos.
  await repo.agregarMensajes(conversacionId, [
    mensajeUsuario,
    { role: "assistant", content: respuesta },
  ]);

  res.json({ respuesta });
}

// Devuelve las últimas 20 conversaciones ordenadas por fecha.
export async function historial(req, res, repo) {
  res.json(await repo.listarRecientes(20));
}

function prepararArchivos(files, lenguaje) {
  let archivos = files.map((file) => ({
    nombre: file.originalname,
    contenido: file.buffer.toString("utf-8"),
  }));

  archivos = archivos.filter(
    (a) => !CARPETAS_IGNORADAS.some((carpeta) => a.nombre.split(/[/\\]/).includes(carpeta))
  );

  if (lenguaje === "javascript" || lenguaje === "typescript") {
    archivos = archivos.filter((a) => a.nombre.endsWith(".js") || a.nombre.endsWith(".ts"));
  }

  archivos = archivos.filter((a) => a.contenido.length < config.analisis.maxBytesPorArchivo);
  archivos = eliminarDuplicados(archivos);
  archivos.sort((a, b) => prioridadArchivo(b) - prioridadArchivo(a));

  return archivos.slice(0, config.analisis.maxArchivos);
}

// Tasa de éxito del modelo: cuántos archivos salieron bien a la primera,
// cuántos necesitaron reparación y cuántos hubo que revertir. Es el dato que
// mide si un modelo pequeño es viable para esta tarea.
//
// Se separan los fallos de sintaxis (no compila) de los de contrato (compila
// pero rompe a quien lo importa), porque son problemas distintos del modelo.
function resumirValidacion(refactorizados) {
  const conteo = (...estados) => refactorizados.filter((r) => estados.includes(r.estado)).length;

  const total = refactorizados.length;
  const validos = conteo(ESTADO.REFACTORIZADO);
  const reparados = conteo(ESTADO.REPARADO_SINTAXIS, ESTADO.REPARADO_CONTRATO);

  const revertidos = refactorizados.filter((r) =>
    [ESTADO.REVERTIDO_SINTAXIS, ESTADO.REVERTIDO_CONTRATO].includes(r.estado)
  );

  return {
    total,
    validosPrimerIntento: validos,
    reparadosTrasError: reparados,
    reparadosPorSintaxis: conteo(ESTADO.REPARADO_SINTAXIS),
    reparadosPorContrato: conteo(ESTADO.REPARADO_CONTRATO),
    revertidos: revertidos.length,
    revertidosPorSintaxis: conteo(ESTADO.REVERTIDO_SINTAXIS),
    revertidosPorContrato: conteo(ESTADO.REVERTIDO_CONTRATO),
    omitidosPorTamanio: conteo(ESTADO.OMITIDO_POR_TAMANIO),
    tasaExito: total > 0 ? Number((((validos + reparados) / total) * 100).toFixed(2)) : 0,
    archivosRevertidos: revertidos.map((r) => ({
      archivo: r.archivo,
      estado: r.estado,
      error: r.error,
    })),
  };
}

// Analiza el proyecto por grupos, resume, refactoriza y empaqueta el resultado.
export async function analizarProyectoIA(req, res, repo) {
  const inicio = iniciarCronometro();

  const lenguaje = req.body?.lenguaje;

  if (!Array.isArray(req.files) || req.files.length === 0) {
    throw errorPeticion("No se recibió ningún archivo");
  }

  const archivos = prepararArchivos(req.files, lenguaje);

  if (archivos.length === 0) {
    throw errorPeticion("Ningún archivo cumple los criterios de análisis (lenguaje o tamaño)");
  }

  const analisisArchivos = await analizarProyecto({ archivos });

  const textos = analisisArchivos.map((a) => `Grupo de archivos: ${a.grupo.join(", ")}\n${a.resultado}`);
  const estructura = archivos.map((a) => a.nombre);

  let resumen = normalizarResumen(await resumirProyecto(textos, estructura));

  if (!validarFormato(resumen)) {
    console.log("Formato incorrecto, reintentando...");
    resumen = normalizarResumen(await resumirProyecto(textos, estructura));
  }

  if (!validarFormato(resumen)) {
    console.log("Fallback activado: la IA no respetó el formato esperado");
    resumen = RESUMEN_POR_DEFECTO;
  }

  // Evaluación de la IA sobre sí misma: útil como narrativa, pero no es una
  // medición. Se guarda por separado de las métricas objetivas.
  const metricas = extraerMetricasFinales(resumen);
  const interpretacion = interpretarMejora(metricas);

  const espacio = crearEspacioTrabajo();

  let nombreZip;
  let refactorizados;

  try {
    refactorizados = await refactorizarProyecto(archivos);

    guardarArchivosRefactorizados(refactorizados, espacio);
    crearReporteCambios(analisisArchivos, espacio);
    crearReporteArquitectura(resumen, espacio);

    nombreZip = await crearZip(espacio);
  } finally {
    // Se limpia también si el empaquetado falla, para no dejar basura en disco.
    limpiarEspacioTrabajo(espacio);
  }

  // Medición objetiva: mismas reglas aplicadas al código original y al
  // refactorizado. Esto sí permite afirmar si hubo mejora.
  const metricasAntes = calcularMetricasCodigo(archivos);
  const metricasDespues = calcularMetricasCodigo(
    refactorizados.map((r) => ({ nombre: r.archivo, contenido: r.codigo }))
  );

  const comparacion = compararMetricas(metricasAntes, metricasDespues);
  const validacion = resumirValidacion(refactorizados);

  const zip = `${config.urlPublica}/refactorizado/${nombreZip}`;

  const { segundos } = finalizarCronometro(inicio);
  const tiempoAnalisis = `${segundos} segundos`;

  const documento = {
    tipo: "analisis_proyecto",
    resumen,
    lenguaje,
    fecha: new Date(),
    // Autoevaluación del modelo (subjetiva).
    metricas,
    interpretacion,
    // Medición determinista sobre el código (objetiva).
    metricasAntes,
    metricasDespues,
    comparacion,
    validacion,
    modelo: config.ollama.modelo,
    tiempoAnalisis,
    zip,
    mensajes: [
      { role: "user", content: "Analiza el proyecto subido por el usuario" },
      { role: "assistant", content: resumen },
    ],
    eliminado: false,
    fechaEliminado: null,
  };

  const conversacionId = await repo.crear(documento);

  res.json({
    archivos: analisisArchivos,
    resumen,
    metricas,
    interpretacion,
    metricasAntes,
    metricasDespues,
    comparacion,
    validacion,
    modelo: config.ollama.modelo,
    zip,
    tiempoAnalisis,
    conversacionId,
  });
}

export async function obtenerConversacion(req, res, repo) {
  validarId(repo, req.params.id);

  const conversacion = await repo.obtenerPorId(req.params.id);

  if (!conversacion) {
    throw errorNoEncontrado("Conversación no encontrada");
  }

  res.json(conversacion);
}

// Borrado lógico: la conversación se marca como eliminada, no se destruye.
export async function eliminarConversacion(req, res, repo) {
  validarId(repo, req.params.id);

  if (!(await repo.marcarEliminada(req.params.id))) {
    throw errorNoEncontrado("Conversación no encontrada o ya eliminada");
  }

  res.json({ mensaje: "Conversación eliminada correctamente" });
}
