// Normalización del reporte CUALITATIVO que devuelve la IA.
//
// Este módulo ya no extrae porcentajes de calidad. Antes se leían del propio
// texto de la IA (`Arquitectura: 60%`), es decir, el sistema evaluado se ponía
// su propia nota: no era reproducible ni verificable. La cuantificación vive
// ahora en `metricasCodigo.js`, que mide el código con reglas deterministas.
//
// La IA conserva lo que sí sabe hacer: diagnosticar qué está mal y dónde.

const SECCIONES = [
  { titulo: "Arquitectura", patron: /#+\s*arquitectura/gi },
  { titulo: "Duplicación de Código", patron: /#+\s*duplicaci[oó]n de c[oó]digo/gi },
  { titulo: "Complejidad", patron: /#+\s*complejidad/gi },
  { titulo: "Organización", patron: /#+\s*organizaci[oó]n/gi },
  { titulo: "Buenas prácticas", patron: /#+\s*buenas pr[aá]cticas/gi },
];

export function validarFormato(resumen) {
  return SECCIONES.every(({ patron }) => new RegExp(patron.source, "i").test(resumen));
}

// Unifica las variantes de encabezado que devuelve el modelo para que
// `validarFormato` y el frontend encuentren siempre las mismas secciones.
export function normalizarResumen(texto) {
  return SECCIONES.reduce(
    (acumulado, { titulo, patron }) => acumulado.replace(patron, `### ${titulo}`),
    texto.replace(/severidad/gi, "SEVERIDAD")
  );
}

export function iniciarCronometro() {
  return Date.now();
}

export function finalizarCronometro(inicio) {
  const transcurrido = Date.now() - inicio;

  return {
    ms: transcurrido,
    segundos: Number((transcurrido / 1000).toFixed(2)),
  };
}
