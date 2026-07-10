// Las métricas de calidad las produce la IA en el resumen; aquí solo se
// normaliza el formato del texto y se extraen los porcentajes.
//
// Nota: `calcularMetricasIniciales`, `extraerMetricas`, `normalizarMetricas`,
// `calcularMejora` y `calcularMejoraPorcentaje` se eliminaron por no estar en
// uso; siguen disponibles en el historial de git si hicieran falta.

const SECCIONES = [
  { titulo: "Arquitectura", patron: /#+\s*arquitectura/gi },
  { titulo: "Duplicación de Código", patron: /#+\s*duplicaci[oó]n de c[oó]digo/gi },
  { titulo: "Complejidad", patron: /#+\s*complejidad/gi },
  { titulo: "Organización", patron: /#+\s*organizaci[oó]n/gi },
  { titulo: "Buenas prácticas", patron: /#+\s*buenas pr[aá]cticas/gi },
];

export function interpretarMejora(metricas) {
  const valores = Object.values(metricas);

  if (valores.length === 0) return "Sin datos";

  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

  if (promedio >= 70) return "Alta calidad";
  if (promedio >= 40) return "Calidad media";

  return "Baja calidad";
}

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

export function extraerMetricasFinales(resumen) {
  const leerPorcentaje = (regex) => {
    const coincidencia = resumen.match(regex);

    return coincidencia ? Number(coincidencia[1]) : 0;
  };

  return {
    arquitectura: leerPorcentaje(/Arquitectura:\s*(\d+(?:\.\d+)?)\s*%/i),
    duplicacion: leerPorcentaje(/Duplicaci[oó]n[^:\n]*:\s*(\d+(?:\.\d+)?)\s*%/i),
    complejidad: leerPorcentaje(/Complejidad:\s*(\d+(?:\.\d+)?)\s*%/i),
    organizacion: leerPorcentaje(/Organizaci[oó]n:\s*(\d+(?:\.\d+)?)\s*%/i),
    buenasPracticas: leerPorcentaje(/Buenas pr[aá]cticas:\s*(\d+(?:\.\d+)?)\s*%/i),
  };
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
