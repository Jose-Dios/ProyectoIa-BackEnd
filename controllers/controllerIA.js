import { ObjectId } from "mongodb";
import { analizarCodigo, chatGeneral, analizarProyecto, resumirProyecto, refactorizarProyecto} from "../services/aiService.js";
// Esta importacion se quito porque ya no se trabaja con direcciones, se cambio a recibir archivos
// import { leerProyecto } from "../utils/leer_proyecto.js";
import { guardarArchivosRefactorizados, crearZip, limpiarCarpetaTemporal, crearReporteCambios} from "../utils/crearZip.js";
import { prioridadArchivo } from "../utils/prioridadArchivo.js";
import { eliminarDuplicados } from "../utils/detectarDuplicados.js";
import { extraerMetricas,validarFormato, normalizarResumen, interpretarMejora, extraerMetricasFinales, normalizarMetricas, calcularMejora, iniciarCronometro, finalizarCronometro } from "../utils/metricas.js"

//Recibe código desde req.body y guarda la conversación en MongoDB
export async function analizar(req,res,db) {
    try {
            //Inicia cronometro
          const inicio = iniciarCronometro();
    
          const { codigo, lenguaje } = req.body;
    
          if (!codigo) {
            return res.status(400).json({ error: "Falta el código" });
          }
    
          const resultado = await analizarCodigo({
            codigo,
            lenguaje: lenguaje || "desconocido"
          });

          const tiempo = finalizarCronometro(inicio);

          const tiempoAnalisis =  `${tiempo.segundos} segundos`;
    
          const conversaciones = db.collection("conversaciones");
    
          const nueva = await conversaciones.insertOne({
            tipo: "analisis_codigo",
            lenguaje,
            codigo,
            fecha: new Date(),
            mensajes: [
              { role: "user", content: "Analiza este código:\n" + codigo },
              { role: "assistant", content: resultado }
            ],
            eliminado: false,
            fechaEliminado: null 
          });
    
          res.json({
            resultado,
            conversacionId: nueva.insertedId
          });
    
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Error interno del servidor"
            });
        }
}

//Recibe el mensaje con un identificador ID, recupera la conversacion de la BD y actualiza conversación en DB y devuelve respuesta.
export async function chat(req,res,db) {
    try {
    
          const { mensaje, conversacionId } = req.body;
    
          if (!mensaje || mensaje.trim() === "") {
            return res.status(400).json({ error: "Mensaje vacío" });
          }
    
          const conversaciones = db.collection("conversaciones");
    
          const conversacion = await conversaciones.findOne({
            _id: new ObjectId(conversacionId),
            eliminado: false
          });
    
          if (!conversacion) {
            return res.status(404).json({ error: "Conversación no encontrada" });
          }
    
          conversacion.mensajes.push({
            role: "user",
            content: mensaje
          });
    
          const respuesta = await chatGeneral({
            mensajes: conversacion.mensajes
          });
    
          conversacion.mensajes.push({
            role: "assistant",
            content: respuesta
          });
    
          await conversaciones.updateOne(
            { _id: conversacion._id },
            { $set: { mensajes: conversacion.mensajes } }
          );
    
          res.json({ respuesta });
    
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Error interno del servidor"
            });
        }
}

//Devuelve las últimas 20 conversaciones ordenadas por fecha
export async function historial(req,res,db) {
    try {

      const conversaciones = db.collection("conversaciones");

      const lista = await conversaciones
        .find({ eliminado: false })
        .sort({ fecha: -1 })
        .limit(20)
        .toArray();

      res.json(lista);

    } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Error interno del servidor"
            });
        }
}

//Se realiza el analisis incluyendo analizar pproyectos por grupos, resumir la respuesta y refactorizar cada archivo
// export async function analizarProyectoIA(req, res, db) {
//   try {
//     const lenguaje = req.body.lenguaje;

//     // archivos desde multer
//     let archivos = req.files.map(file => ({
//       nombre: file.webkitRelativePath || file.originalname,
//       contenido: file.buffer.toString("utf-8")
//     }));

//     // filtrar carpetas basura
//     archivos = archivos.filter(a =>
//       !a.nombre.includes("node_modules") &&
//       !a.nombre.includes(".git") &&
//       !a.nombre.includes("dist") &&
//       !a.nombre.includes("build") &&
//       !a.nombre.includes("coverage")
//     );

//     // filtrar por lenguaje
//     if (lenguaje === "javascript" || lenguaje === "typescript") {
//       archivos = archivos.filter(a =>
//         a.nombre.endsWith(".js") || a.nombre.endsWith(".ts")
//       );
//     }

//     // limitar tamaño
//     archivos = archivos.filter(a => a.contenido.length < 50000);

//     // eliminar duplicados
//     archivos = eliminarDuplicados(archivos);

//     // ordenar por prioridad
//     archivos.sort((a, b) => prioridadArchivo(b) - prioridadArchivo(a));

//     // limitar cantidad
//     if (archivos.length > 10) {
//       archivos = archivos.slice(0, 10);
//     }

//     const analisisArchivos = await analizarProyecto({ archivos });

//     const totalArchivos = archivos.length;

//     // const metricasAntesraw = calcularMetricasIniciales(archivos);
//     // const metricasAntes = normalizarMetricasIniciales(metricasAntesraw);
//     const metricasAntesRaw = calcularMetricasIniciales(archivos);
//     const metricasAntes = normalizarMetricas(metricasAntesRaw, totalArchivos);

//     // SOLO REFACTORIZACIÓN (sin reanálisis)
//     const refactorizados = await refactorizarProyecto(archivos);

    
//     // const metricasDespuesRaw = extraerMetricas(analisisArchivos);
//     // const metricasDespues = normalizarMetricasIA(metricasDespuesRaw, archivos.length);
//     // const metricasDespuesRaw = extraerMetricas(analisisArchivos);
//     // const metricasDespues = normalizarMetricas(metricasDespuesRaw, totalArchivos);

//     // const mejora = calcularMejora(metricasAntes, metricasDespues);
//     // const interpretacion = interpretarMejora(mejora);

//     // extraer métricas desde la IA
//     const metricas = extraerMetricasFinales(resumen);

//     // interpretación basada en métricas de la IA
//     const interpretacion = interpretarMejora(metricas);

//     // resumen
//     // const textos = analisisArchivos.map(a =>
//     //   `Archivo: ${a.archivo}\nAnálisis:\n${a.resultado}`
//     // );
//     const textos = analisisArchivos.map(a =>
//       `Grupo de archivos: ${a.grupo.join(", ")}\n${a.resultado}`
//     );

//     const estructura = archivos.map(a => a.nombre);

//     // let resumen = await resumirProyecto(textos, estructura, mejora);
//     let resumen = await resumirProyecto(textos, estructura, {});

//     // normalizar
//     resumen = normalizarResumen(resumen);

//     // retry
//     if (!validarFormato(resumen)) {
//       console.log("Formato incorrecto, reintentando...");
//       resumen = await resumirProyecto(textos, estructura, {});
//     }

//     // fallback
//     if (!validarFormato(resumen)) {
//       console.log("Fallback activado");

//       resumen = `
// # REPORTE DE CALIDAD DEL SOFTWARE

// ## Problemas detectados

// ### Arquitectura
// No se pudo analizar correctamente.

// ### Duplicación de Código
// No se pudo analizar correctamente.

// ### Complejidad
// No se pudo analizar correctamente.

// ### Organización
// No se pudo analizar correctamente.

// ### Buenas prácticas
// No se pudo analizar correctamente.
//       `;
//     }

//     // ZIP
//     const carpetaTemp = guardarArchivosRefactorizados(refactorizados);
//     crearReporteCambios(analisisArchivos);
//     const nombreZip = await crearZip(carpetaTemp);
//     limpiarCarpetaTemporal();

//     // BD
//     const conversaciones = db.collection("conversaciones");

//     const zip = `http://localhost:3000/refactorizado/${nombreZip}`;

//     const nuevaConversacion = await conversaciones.insertOne({
//       tipo: "analisis_proyecto",
//       rutaProyecto: "subido_por_usuario",
//       analisisArchivos,
//       resumen,
//       lenguaje,
//       fecha: new Date(),
//       mensajes: [
//         {
//           role: "system",
//           content: "Eres un asistente experto en programación, arquitectura y refactorización de software."
//         },
//         {
//           role: "user",
//           content: `Analiza el proyecto subido por el usuario`
//         },
//         {
//           role: "assistant",
//           content: `
// Resumen del análisis del proyecto:

// ${resumen}

// Mejora estimada:
// - Arquitectura: ${mejora.arquitectura}%
// - Duplicación: ${mejora.duplicacion}%
// - Complejidad: ${mejora.complejidad}%
// - Organización: ${mejora.organizacion}%
// - Buenas prácticas: ${mejora.buenasPracticas}%
// - Promedio: ${mejora.promedio.toFixed(2)}%

// Interpretación:
// ${interpretacion}

// Archivos analizados: ${archivos.length}
//           `
//         }
//       ],
//       metricasAntes,
//       metricasDespues,
//       mejora,
//       interpretacion,
//       zip,
//       eliminado: false,
//       fechaEliminado: null
//     });

//     res.json({
//       archivos: analisisArchivos,
//       resumen,
//       zip,
//       metricasAntes,
//       metricasDespues,
//       mejora,
//       interpretacion,
//       conversacionId: nuevaConversacion.insertedId
//     });

//   } catch (error) {
//     console.error(error);

//     res.status(500).json({
//       error: "Error interno del servidor"
//     });
//   }
// }

export async function analizarProyectoIA(req, res, db) {
  try {
    //Inicia cronometro
    const inicio = iniciarCronometro();

    const lenguaje = req.body.lenguaje;

    let archivos = req.files.map(file => ({
      nombre: file.webkitRelativePath || file.originalname,
      contenido: file.buffer.toString("utf-8")
    }));

    // filtros
    archivos = archivos.filter(a =>
      !a.nombre.includes("node_modules") &&
      !a.nombre.includes(".git") &&
      !a.nombre.includes("dist") &&
      !a.nombre.includes("build") &&
      !a.nombre.includes("coverage")
    );

    if (lenguaje === "javascript" || lenguaje === "typescript") {
      archivos = archivos.filter(a =>
        a.nombre.endsWith(".js") || a.nombre.endsWith(".ts")
      );
    }

    archivos = archivos.filter(a => a.contenido.length < 50000);

    archivos = eliminarDuplicados(archivos);
    archivos.sort((a, b) => prioridadArchivo(b) - prioridadArchivo(a));

    if (archivos.length > 10) {
      archivos = archivos.slice(0, 10);
    }

    
    // ANÁLISIS IA
    const analisisArchivos = await analizarProyecto({ archivos });

    // TEXTOS PARA RESUMEN
    const textos = analisisArchivos.map(a =>
      `Grupo de archivos: ${a.grupo.join(", ")}\n${a.resultado}`
    );

    const estructura = archivos.map(a => a.nombre);

    // RESUMEN IA
    let resumen = await resumirProyecto(textos, estructura);

    resumen = normalizarResumen(resumen);

    // retry
    if (!validarFormato(resumen)) {
      console.log("Formato incorrecto, reintentando...");
      resumen = await resumirProyecto(textos, estructura, {});
      resumen = normalizarResumen(resumen);
    }

    // fallback
    if (!validarFormato(resumen)) {
      console.log("Fallback activado");

      resumen = `
        # REPORTE DE CALIDAD DEL SOFTWARE

        ## Métricas de mejora
        Arquitectura: 0%
        Duplicación: 0%
        Complejidad: 0%
        Organización: 0%
        Buenas prácticas: 0%
              `;
    }

    // MÉTRICAS DESDE IA
    const metricas = extraerMetricasFinales(resumen);

    // INTERPRETACIÓN
    const interpretacion = interpretarMejora(metricas);

    // ZIP
    const refactorizados = await refactorizarProyecto(archivos);
    const carpetaTemp = guardarArchivosRefactorizados(refactorizados);
    crearReporteCambios(analisisArchivos);
    const nombreZip = await crearZip(carpetaTemp);
    limpiarCarpetaTemporal();

    const zip = `http://localhost:3000/refactorizado/${nombreZip}`;

    // BD
    const conversaciones = db.collection("conversaciones");

    const tiempo = finalizarCronometro(inicio);

    const tiempoAnalisis =  `${tiempo.segundos} segundos`;

    const nuevaConversacion = await conversaciones.insertOne({
      tipo: "analisis_proyecto",
      resumen,
      lenguaje,
      fecha: new Date(),
      metricas,
      interpretacion,
      tiempoAnalisis,
      zip,
      mensajes: [
            { role: "user", content: "Analiza este archivo:\n"},
            { role: "assistant", content: resumen }
        ],
      eliminado: false, 
      fechaEliminado: null
    });

    // RESPUESTA
    res.json({
      archivos: analisisArchivos,
      resumen,
      metricas,
      interpretacion,
      zip,
      tiempoAnalisis: `${tiempo.segundos} segundos`,
      conversacionId: nuevaConversacion.insertedId
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
}

export async function obtenerConversacion(req,res,db) {
    try {
    
          const conversaciones = db.collection("conversaciones");
    
          const conversacion = await conversaciones.findOne({
            _id: new ObjectId(req.params.id),
            eliminado: false
          });
    
          res.json(conversacion);
    
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Error interno del servidor"
            });
        }

}

//Esa funcion esta realizando un soft delete
export async function eliminarConversacion(req,res,db) {
  try{
    const conversaciones = db.collection("conversaciones");

    const id = req.params.id;

    const resultado = await conversaciones.updateOne(
      { _id: new ObjectId(id), eliminado: false },
      { 
        $set: { 
          eliminado: true,
          fechaEliminado: new Date()
        } 
      }
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).json({ error: "Conversación no encontrada o ya eliminada" });
    }
    
    res.json({ mensaje: "Conversación eliminada correctamente" });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
  
}