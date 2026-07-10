import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { llamarIA } from "./aiControl.js";
import { validarSintaxis } from "./validarCodigo.js";
import { validarContrato } from "./validarContrato.js";
import { config } from "../config/env.js";

const directorioActual = path.dirname(fileURLToPath(import.meta.url));

// Ruta anclada al módulo, no al directorio desde el que se lanza `node`.
const reglas = fs.readFileSync(path.join(directorioActual, "..", "reglas.txt"), "utf-8");

// Los modelos envuelven el código en bloques markdown pese a pedirles lo
// contrario, y además lo rodean de prosa ("A continuación se presenta...",
// "En este refactorizado se ha..."). Sin extraer el bloque, esa prosa acaba
// dentro de los .js del ZIP y el archivo no compila.
//
// No basta con comprobar si la respuesta ENTERA es un bloque: hay que buscar
// el bloque dentro del texto.
export function limpiarBloqueDeCodigo(texto) {
  const contenido = texto.trim();

  const bloques = [...contenido.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map((m) => m[1]);

  if (bloques.length > 0) {
    // Si el modelo emite varios bloques (código + ejemplo de uso), el archivo
    // refactorizado es casi siempre el más largo.
    return bloques.reduce((mayor, actual) => (actual.length > mayor.length ? actual : mayor)).trim();
  }

  // Bloque abierto pero nunca cerrado: ocurre cuando el modelo agota su límite
  // de tokens a mitad de archivo. Nos quedamos con todo lo que sigue al fence.
  const aperturaSinCierre = contenido.match(/```[a-zA-Z]*\s*\n([\s\S]*)$/);

  if (aperturaSinCierre) return aperturaSinCierre[1].trim();

  return contenido;
}

function agruparArchivos(archivos, tamanioGrupo = config.analisis.tamanioGrupo) {
  const grupos = [];

  for (let i = 0; i < archivos.length; i += tamanioGrupo) {
    grupos.push(archivos.slice(i, i + tamanioGrupo));
  }

  return grupos;
}

export async function analizarCodigo({ codigo, lenguaje }) {
  const prompt = `
Eres un revisor de código para el proyecto de una empresa.
Aplica estas reglas de buenas prácticas:
${reglas}

Lenguaje: ${lenguaje}

Código:
${codigo}

Devuelve:
1) Problemas detectados
2) Sugerencias
3) Versión refactorizada del código
`;

  return llamarIA({ prompt });
}

export async function chatGeneral({ mensajes }) {
  // Descartamos los `system` almacenados para no acumular instrucciones
  // duplicadas cada vez que se reanuda una conversación.
  const historial = mensajes.filter((m) => m.role !== "system").slice(-8);

  return llamarIA({
    messages: [
      {
        role: "system",
        content: "Eres un asistente experto en programación, revisión y refactorización de código.",
      },
      ...historial,
    ],
  });
}

export async function analizarProyecto({ archivos }) {
  const grupos = agruparArchivos(archivos);
  const resultados = [];

  for (const grupo of grupos) {
    const contenidoGrupo = grupo
      .map((a) => `Archivo: ${a.nombre}\n${a.contenido}`)
      .join("\n\n");

    const prompt = `
Eres un ingeniero de software experto.

Analiza los siguientes archivos en conjunto:

${contenidoGrupo}

Devuelve:

1. Responsabilidades de cada archivo
2. Posible duplicación entre archivos
3. Problemas de arquitectura
4. Sugerencias de refactorización
`;

    resultados.push({
      grupo: grupo.map((a) => a.nombre),
      resultado: await llamarIA({ prompt }),
    });
  }

  return resultados;
}

export async function resumirProyecto(analisisArchivos, estructura) {
  // Reducción de contexto: el modelo local no soporta prompts muy largos.
  const analisisReducido = analisisArchivos.slice(0, 5).map((a) => a.slice(0, 1500));
  const estructuraReducida = estructura.slice(0, 10);

  const prompt = `
Eres un arquitecto de software.

Estructura del proyecto:
${estructuraReducida.join("\n")}

Estos son análisis individuales de archivos:
${analisisReducido.join("\n\n")}

Genera un REPORTE PROFESIONAL DE CALIDAD DEL SOFTWARE.

# REPORTE DE CALIDAD DEL SOFTWARE

## Problemas detectados

IMPORTANTE:
Usa el siguiente formato como guía e intenta respetarlo lo mejor posible:

### Arquitectura
SEVERIDAD: Baja | Media | Alta | Crítica
ARCHIVOS AFECTADOS:
DESCRIPCIÓN:
RECOMENDACIÓN DE SOLUCIÓN:

### Duplicación de Código
SEVERIDAD: Baja | Media | Alta | Crítica
ARCHIVOS AFECTADOS:
DESCRIPCIÓN:
RECOMENDACIÓN DE SOLUCIÓN:

### Complejidad
SEVERIDAD: Baja | Media | Alta | Crítica
ARCHIVOS AFECTADOS:
DESCRIPCIÓN:
RECOMENDACIÓN DE SOLUCIÓN:

### Organización
SEVERIDAD: Baja | Media | Alta | Crítica
ARCHIVOS AFECTADOS:
DESCRIPCIÓN:
RECOMENDACIÓN DE SOLUCIÓN:

### Buenas prácticas
SEVERIDAD: Baja | Media | Alta | Crítica
ARCHIVOS AFECTADOS:
DESCRIPCIÓN:
RECOMENDACIÓN DE SOLUCIÓN:

REGLAS:
- No cambies los títulos
- Mantén el orden
- No agregues nuevas categorías
- Usa "SEVERIDAD" en mayúsculas
- Si no hay problema: SEVERIDAD: Baja
- Mantén el formato lo más fiel posible

## Evaluación global del proyecto

Calidad general: (Baja, Media o Alta)
Mantenibilidad: (Baja, Media o Alta)
Escalabilidad: (Baja, Media o Alta)

## Recomendaciones prioritarias

IMPORTANTE:
- NO inventes porcentajes ni puntuaciones numéricas de calidad.
- La cuantificación la calcula el sistema midiendo el código; tu tarea es el
  diagnóstico cualitativo: qué está mal, dónde, y cómo arreglarlo.
`;

  return llamarIA({ prompt });
}

function promptRefactor({ nombre, contenido }) {
  return `
Eres un ingeniero de software experto.

Refactoriza el siguiente archivo manteniendo EXACTAMENTE la misma funcionalidad.

Ruta del archivo:
${nombre}

Código original:
${contenido}

REGLAS CRÍTICAS (OBLIGATORIAS):

- NO cambiar endpoints
- NO cambiar método HTTP (POST, GET, etc.)
- NO cambiar estructura de fetch
- NO cambiar nombres de variables existentes
- NO cambiar la forma en que se envían datos al backend
- NO cambiar la forma en que se recibe la respuesta

Si haces alguno de estos cambios, la respuesta es incorrecta.

Solo puedes:
- mejorar formato
- mejorar legibilidad
- reducir duplicación
- agregar comentarios

IMPORTANTE:
Devuelve el archivo COMPLETO, desde la primera hasta la última línea.
Si no hay mejoras claras, devuelve el código casi igual.

Agrega comentarios SOLO donde hagas cambios usando:

// CAMBIO IA:
// explicación breve

Devuelve SOLO el código, sin bloques markdown.
`;
}

// Estados posibles de un archivo tras pasar por el modelo.
export const ESTADO = {
  REFACTORIZADO: "refactorizado",
  OMITIDO_POR_TAMANIO: "omitido_por_tamanio",
  REPARADO_SINTAXIS: "reparado_tras_error_de_sintaxis",
  REPARADO_CONTRATO: "reparado_tras_romper_el_contrato",
  REVERTIDO_SINTAXIS: "revertido_por_sintaxis_invalida",
  REVERTIDO_CONTRATO: "revertido_por_contrato_roto",
};

// Dos verificaciones en cascada, de la más barata a la más cara de arreglar:
// primero que compile, después que siga exponiendo lo mismo.
async function verificar(nombre, original, generado) {
  if (config.analisis.validarSintaxis) {
    const sintaxis = await validarSintaxis(nombre, generado);

    if (!sintaxis.valido) return { valido: false, tipo: "sintaxis", motivo: sintaxis.motivo };
  }

  if (config.analisis.validarContrato) {
    const contrato = validarContrato(original, generado);

    if (!contrato.valido) return { valido: false, tipo: "contrato", motivo: contrato.motivo, ...contrato };
  }

  return { valido: true };
}

function promptReparacion(codigo, revision) {
  if (revision.tipo === "sintaxis") {
    return `
El siguiente código JavaScript tiene un error de sintaxis:

${codigo}

Error del intérprete:
${revision.motivo}

Corrige ÚNICAMENTE el error de sintaxis, sin cambiar la lógica.
Devuelve el archivo COMPLETO y SOLO el código, sin bloques markdown.
`;
  }

  return `
El siguiente código JavaScript compila, pero ROMPE el contrato público del
módulo: has eliminado o renombrado cosas que otros archivos necesitan.

${codigo}

Problema detectado:
${revision.motivo}

Restaura EXACTAMENTE los nombres y rutas originales que se perdieron, sin
deshacer las demás mejoras de formato y legibilidad.
Devuelve el archivo COMPLETO y SOLO el código, sin bloques markdown.
`;
}

export async function refactorizarArchivo({ nombre, contenido }) {
  const generado = limpiarBloqueDeCodigo(await llamarIA({ prompt: promptRefactor({ nombre, contenido }) }));

  const primeraRevision = await verificar(nombre, contenido, generado);

  if (primeraRevision.valido) {
    return { archivo: nombre, codigo: generado, estado: ESTADO.REFACTORIZADO };
  }

  // Auto-reparación: al modelo se le devuelve el fallo exacto. Un modelo
  // pequeño suele corregir errores mecánicos si se le señala dónde están.
  console.log(`Fallo de ${primeraRevision.tipo} en ${nombre}, solicitando corrección...`);

  const reparado = limpiarBloqueDeCodigo(
    await llamarIA({ prompt: promptReparacion(generado, primeraRevision) })
  );

  // El reintento se revisa entero: al arreglar la sintaxis pudo romper el
  // contrato, y viceversa.
  const segundaRevision = await verificar(nombre, contenido, reparado);

  if (segundaRevision.valido) {
    return {
      archivo: nombre,
      codigo: reparado,
      estado:
        primeraRevision.tipo === "sintaxis" ? ESTADO.REPARADO_SINTAXIS : ESTADO.REPARADO_CONTRATO,
    };
  }

  // El modelo no fue capaz de producir un refactor utilizable: se conserva el
  // original. Entregar código roto es peor que no refactorizar nada.
  console.log(`Revirtiendo ${nombre}: ${segundaRevision.motivo}`);

  return {
    archivo: nombre,
    codigo: contenido,
    estado:
      segundaRevision.tipo === "sintaxis" ? ESTADO.REVERTIDO_SINTAXIS : ESTADO.REVERTIDO_CONTRATO,
    error: segundaRevision.motivo,
  };
}

export async function refactorizarProyecto(archivos) {
  const resultados = [];

  for (const archivo of archivos) {
    // Truncar el contenido produciría archivos cortados a la mitad en el ZIP.
    // Ante un archivo demasiado grande preferimos devolverlo intacto.
    if (archivo.contenido.length > config.analisis.maxCaracteresRefactor) {
      console.log(`Omitiendo (demasiado grande): ${archivo.nombre}`);

      resultados.push({
        archivo: archivo.nombre,
        codigo: archivo.contenido,
        estado: ESTADO.OMITIDO_POR_TAMANIO,
      });

      continue;
    }

    console.log("Refactorizando:", archivo.nombre);

    resultados.push(
      await refactorizarArchivo({ nombre: archivo.nombre, contenido: archivo.contenido })
    );
  }

  return resultados;
}
