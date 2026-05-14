import axios from "axios";
import fs from "fs";
import "dotenv/config";
import { llamarIA } from "./aiControl.js";

//Aqui se realiza las conecciones con el modelo IA
// const OLLAMA_URL = "http://localhost:11434/api/generate";
// const OLLAMA_URL = "http://localhost:11434/api/chat";
// const OLLAMA_URL = process.env.OLLAMA;
// const MODEL = process.env.MODELO; 
// Cargo reglas al iniciar el
const reglas = fs.readFileSync("reglas.txt", "utf-8");

//Esta funcion es para analizar los archivos de 3 en 3
function agruparArchivos(archivos, tamañoGrupo = 3) {

  const grupos = [];

  for (let i = 0; i < archivos.length; i += tamañoGrupo) {
    grupos.push(archivos.slice(i, i + tamañoGrupo));
  }

  return grupos;

}

//Se obtiene el codigo y lenguaje para su analisis, aqui entra los fragmentos de codigo
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

      // const response = await axios.post(OLLAMA_URL, {
      //   model: MODEL,
      //   prompt,
      //   stream: false
      // });

  // const response = await axios.post(
  //   OLLAMA_URL,
  //   {
  //     model: MODEL,
  //     messages: [
  //       {
  //         role: "user",
  //         content: prompt
  //       }
  //     ],
  //     stream: false
  //   }
  // );

  // // return response.data.response;
  // return response.data.message.content;

  return await llamarIA({prompt});
}

//Llama al modelo IA para generar respuesta de asistente experto en programación, limitandose a los ultimos 8 mensajes y el rol del sistema
export async function chatGeneral({ mensajes }) {

  const mensajesRecientes = [
    {
      role: "system",
      content: "Eres un asistente experto en programación, revisión y refactorización de código."
    },
    ...mensajes.slice(-8)
  ];

  // const response = await axios.post(
  //   OLLAMA_URL,
  //   {
  //     model: MODEL,
  //     messages: mensajesRecientes,
  //     stream: false,
  //     options: {
  //       temperature: 0.2
  //     }
  //   }
  // );
  // return response.data.message.content;
  return await llamarIA({messages: mensajesRecientes})
}

// Genera un prompt que analiza responsabilidades, duplicación, problemas de arquitectura y sugerencias
//Llama a la IA y guarda resultados por grupo
export async function analizarProyecto({ archivos }) {

  const grupos = agruparArchivos(archivos, 3);

  const resultados = [];

  for (const grupo of grupos) {

    const contenidoGrupo = grupo.map(a =>
      `Archivo: ${a.nombre}\n${a.contenido}`
    ).join("\n\n");

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

    // const response = await axios.post(
    //   OLLAMA_URL,
    //   {
    //     model: MODEL,
    //     messages: [
    //       {
    //         role: "user",
    //         content: prompt
    //       }
    //     ],
    //     stream: false
    //   }
    // );
    // resultados.push({
    //   grupo: grupo.map(a => a.nombre),
    //   resultado: response.data.message.content
    // });

    const resultado = await llamarIA({prompt});
    resultados.push({
      grupo: grupo.map(a => a.nombre),
      resultado
    })
  }

  return resultados;

}

//Recibe análisis de archivos y estructura del proyecto, generando un reporte profesional de calida de software
// export async function resumirProyecto(analisisArchivos, estructura, mejora) {

//   const prompt = `
//     Eres un arquitecto de software.

//     Estructura del proyecto:
//     ${estructura.join("\n")}

//     Estos son análisis individuales de archivos:
//     ${analisisArchivos.join("\n\n")}

//     Genera un REPORTE PROFESIONAL DE CALIDAD DEL SOFTWARE.

//     # REPORTE DE CALIDAD DEL SOFTWARE

//     ## Problemas detectados

//     IMPORTANTE:
//     Debes usar EXACTAMENTE el siguiente formato, sin cambiar nada:

//     ### Arquitectura
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Duplicación de Código
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Complejidad
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Organización
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Buenas prácticas
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     REGLAS:
//     - NO cambies los títulos.
//     - No cambiar el orden.
//     - NO agregues nuevas categorías.
//     - La palabra "SEVERIDAD" debe estar en mayúsculas.
//     - No omitir la severidad en ninguna sección.
//     - SI no hay problema, escribe: SEVERIDAD: Baja.
//     - No agregar texto antes de "SEVERIDAD".
//     - RESPETA exactamente el formato.

//     ## Evaluación global del proyecto

//     Calidad general: (elige SOLO UNA: Baja, Media o Alta)
//     Mantenibilidad: (elige SOLO UNA: Baja, Media o Alta)
//     Escalabilidad: (elige SOLO UNA: Baja, Media o Alta)

//     ## Métricas de mejora calculadas automáticamente

//     Arquitectura: ${mejora.arquitectura}%
//     Duplicación de código: ${mejora.duplicacion}%
//     Complejidad: ${mejora.complejidad}%
//     Organización: ${mejora.organizacion}%
//     Buenas prácticas: ${mejora.buenasPracticas}%
//     Mejora promedio: ${mejora.promedio.toFixed(2)}%
    

//     ## Impacto de la refactorización
//     Explica si la mejora es:
//       - Significativa
//       - Moderada
//       - Baja

//     ## Recomendaciones prioritarias

//     ## Si tiene alguna duda puede preguntarme en la sección CHAT CON IA.
    
//     `;


//   // const response = await axios.post(
//   //   OLLAMA_URL,
//   //   {
//   //     model: MODEL,
//   //     messages: [
//   //       {
//   //         role: "user",
//   //         content: prompt
//   //       }
//   //     ],
//   //     stream: false
//   //   }
//   // );
//   // return response.data.message.content;

//   return await llamarIA({prompt});
// }
// export async function resumirProyecto(analisisArchivos, estructura, mejora) {

//   // Reduccion de contexto ya que la capacidad de la IA no lo soporta
//   const analisisReducido = analisisArchivos
//     .slice(0, 5) // máximo 5 archivos
//     .map(a => a.slice(0, 1500)); // recorte por archivo

//   const estructuraReducida = estructura.slice(0, 10);

//   const prompt = `
//     Eres un arquitecto de software.

//     Estructura del proyecto:
//     ${estructuraReducida.join("\n")}

//     Estos son análisis individuales de archivos:
//     ${analisisReducido.join("\n\n")}

//     Genera un REPORTE PROFESIONAL DE CALIDAD DEL SOFTWARE.

//     # REPORTE DE CALIDAD DEL SOFTWARE

//     ## Problemas detectados

//     IMPORTANTE:
//     Usa el siguiente formato como guía e intenta respetarlo lo mejor posible:

//     ### Arquitectura
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Duplicación de Código
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Complejidad
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Organización
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     ### Buenas prácticas
//     SEVERIDAD: Baja | Media | Alta | Crítica
//     ARCHIVOS AFECTADOS:
//     DESCRIPCIÓN:
//     RECOMENDACIÓN DE SOLUCIÓN:

//     REGLAS:
//     - No cambies los títulos
//     - Mantén el orden
//     - No agregues nuevas categorías
//     - Usa "SEVERIDAD" en mayúsculas
//     - Si no hay problema: SEVERIDAD: Baja
//     - Mantén el formato lo más fiel posible

//     ## Evaluación global del proyecto

//     Calidad general: (Baja, Media o Alta)
//     Mantenibilidad: (Baja, Media o Alta)
//     Escalabilidad: (Baja, Media o Alta)

//     ## Métricas de mejora

//     Arquitectura: ${mejora.arquitectura}%
//     Duplicación de código: ${mejora.duplicacion}%
//     Complejidad: ${mejora.complejidad}%
//     Organización: ${mejora.organizacion}%
//     Buenas prácticas: ${mejora.buenasPracticas}%
//     Mejora promedio: ${mejora.promedio.toFixed(2)}%

//     ## Impacto de la refactorización
//     (Significativa, Moderada o Baja)

//     ## Recomendaciones prioritarias
//   `;

//   return await llamarIA({ prompt });
// }
export async function resumirProyecto(analisisArchivos, estructura) {

  // Reducción de contexto
  const analisisReducido = analisisArchivos
    .slice(0, 5)
    .map(a => a.slice(0, 1500));

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

## Métricas de calidad del software

IMPORTANTE:
- Los valores representan NIVEL DE CALIDAD, no cantidad de mejora
- 0% = muy mala calidad (muchos problemas)
- 100% = excelente calidad (sin problemas)
- Basa los valores en la severidad detectada anteriormente

Arquitectura: X%
Duplicación de código: X%
Complejidad: X%
Organización: X%
Buenas prácticas: X%

## Impacto de la refactorización
(Significativa, Moderada o Baja)

## Recomendaciones prioritarias
`;

  return await llamarIA({ prompt });
}

// export async function resumirProyecto(analisisArchivos, estructura) {

//     const prompt = `
//     Eres un arquitecto de software.

//     Estructura del proyecto:
//     ${estructura.join("\n")}

//     Estos son análisis individuales de archivos:
//     ${analisisArchivos.join("\n\n")}

//     Genera un REPORTE PROFESIONAL DE CALIDAD DEL SOFTWARE.

//     # REPORTE DE CALIDAD DEL SOFTWARE

//     ## Problemas detectados

//     Organiza los problemas usando EXACTAMENTE estas secciones:

//     ### Arquitectura
//     ### Duplicación de Código
//     ### Complejidad
//     ### Organización
//     ### Buenas prácticas

//     Para cada sección incluye:

//     SEVERIDAD: Baja | Media | Alta | Crítica  
//     ARCHIVOS AFECTADOS  
//     DESCRIPCIÓN  
//     RECOMENDACIÓN DE SOLUCIÓN  

//     IMPORTANTE:
//     - No cambies los nombres de las secciones
//     - No agregues nuevas categorías
//     - No uses el formato "TIPO"

//     ## Evaluación global del proyecto

//     Calidad general:
//     Mantenibilidad:
//     Escalabilidad:

//     ## Recomendaciones prioritarias

//     Finalmente, invita al usuario a hacer preguntas en el chat si tiene dudas.
//     `;

//   const response = await axios.post(
//     OLLAMA_URL,
//     {
//       model: MODEL,
//       messages: [
//         {
//           role: "user",
//           content: prompt
//         }
//       ],
//       stream: false
//     }
//   );

//   return response.data.message.content;
// }

//Refactoriza cada archivo individual con apoyo de la IA, devolviendolo respetando la funcionalidad original 
export async function refactorizarArchivo({ nombre, contenido }) {

  const prompt = `
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
    Si no hay mejoras claras, devuelve el código casi igual.

    Agrega comentarios SOLO donde hagas cambios usando:

    // CAMBIO IA:
    // explicación breve

    Devuelve SOLO el código.
    `;

      // const response = await axios.post(
      //   OLLAMA_URL,
      //   {
      //     model: MODEL,
      //     messages: [
      //       {
      //         role: "user",
      //         content: prompt
      //       }
      //     ],
      //     stream: false
      //   }
      // );

      const codigo = await llamarIA({prompt})
      return {
        archivo: nombre,
        codigo
      };
}

//Llama a refactorizarArchivo y retorna todos los archivos refactorizados
export async function refactorizarProyecto(archivos) {

  const resultados = [];

  for (const archivo of archivos) {

    console.log("Refactorizando:", archivo.nombre);

    const resultado = await refactorizarArchivo({
      nombre: archivo.nombre,
      contenido: archivo.contenido.slice(0, 3000)
    });

    resultados.push(resultado);
  }

  return resultados;
}