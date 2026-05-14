
//se extrae las metricas de que se mejora en el codigo
// “Las métricas de calidad fueron obtenidas mediante la inversión proporcional de la severidad detectada, permitiendo representar la calidad del software en una escala porcentual.”
export function extraerMetricas(analisis) {

  const severidadANumero = (nivel) => {
    switch (nivel) {
      case "crítica": return 4;
      case "alta": return 3;
      case "media": return 2;
      case "baja": return 1;
      default: return 1; // fallback seguro
    }
  };

  const obtenerSeveridad = (bloque) => {
    if (!bloque) return "baja";

    const match = bloque.match(/severidad\s*:\s*(baja|media|alta|cr[ií]tica)/i);

    if (match) return match[1].toLowerCase();

      if (bloque.includes("crítico") || bloque.includes("critico")) return "crítica";
      if (bloque.includes("grave")) return "alta";
      if (bloque.includes("mejorar")) return "media";

      return "baja";
  };

  let arquitectura = 0;
  let duplicacion = 0;
  let complejidad = 0;
  let organizacion = 0;
  let buenasPracticas = 0;

  for (const a of analisis) {

    const texto = a.resultado.toLowerCase();

    const getBloque = (titulo) => {
      const regex = new RegExp(`###\\s*${titulo}([\\s\\S]*?)(?=###|$)`, "i");
      return texto.match(regex)?.[1] || "";
    };

    const bArquitectura = getBloque("arquitectura");
    const bDuplicacion = getBloque("duplicaci[oó]n de c[oó]digo");
    const bComplejidad = getBloque("complejidad");
    const bOrganizacion = getBloque("organizaci[oó]n");
    const bBuenas = getBloque("buenas prácticas");

    arquitectura += severidadANumero(obtenerSeveridad(bArquitectura));
    duplicacion += severidadANumero(obtenerSeveridad(bDuplicacion));
    complejidad += severidadANumero(obtenerSeveridad(bComplejidad));
    organizacion += severidadANumero(obtenerSeveridad(bOrganizacion));
    buenasPracticas += severidadANumero(obtenerSeveridad(bBuenas));
  }

  const convertirACalidad = (valor, max) => {
  return Number((((max - valor) / max) * 100).toFixed(2));
};

  const max = analisis.length * 4; // 4 = severidad máxima por archivo

  return {
    arquitectura: convertirACalidad(arquitectura, max),
    duplicacion: convertirACalidad(duplicacion, max),
    complejidad: convertirACalidad(complejidad, max),
    organizacion: convertirACalidad(organizacion, max),
    buenasPracticas: convertirACalidad(buenasPracticas, max)
  };
}

export function calcularMetricasIniciales(archivos) {

  let arquitectura = 0;
  let duplicacion = 0;
  let complejidad = 0;
  let organizacion = 0;
  let buenasPracticas = 0;

  for (const a of archivos) {

    const codigo = a.contenido;

    // Complejidad básica (ifs, fors, etc)
    const complejidadMatch = codigo.match(/if|for|while|switch/g);
    complejidad += complejidadMatch ? complejidadMatch.length : 0;

    // Duplicación simple (funciones repetidas)
    const funciones = codigo.match(/function\s+\w+/g);
    duplicacion += funciones ? funciones.length : 0;

    // Organización (cantidad de líneas)
    const lineas = codigo.split("\n").length;
    organizacion += lineas;

    // Buenas prácticas (console.log como mala práctica simple)
    const malas = codigo.match(/console\.log/g);
    buenasPracticas += malas ? malas.length : 0;

    // Arquitectura (muy básico)
    if (codigo.includes("document.getElementById")) {
      arquitectura += 2;
    }

  }

  return {
    arquitectura,
    duplicacion,
    complejidad,
    organizacion,
    buenasPracticas
  };
}

export function calcularMejoraPorcentaje(antes, despues) {
  //a = antes
  //d = despues
  // se aplica la formula mejora = antes - despues / antes  * 100
  const calcular = (a, d) =>
  a ? Number((((a - d) / a) * 100).toFixed(2)) : 0;

  return {
    arquitectura: calcular(antes.arquitectura, despues.arquitectura),
    duplicacion: calcular(antes.duplicacion, despues.duplicacion),
    complejidad: calcular(antes.complejidad, despues.complejidad),
    organizacion: calcular(antes.organizacion, despues.organizacion),
    buenasPracticas: calcular(antes.buenasPracticas, despues.buenasPracticas),
    promedio: (
      calcular(antes.arquitectura, despues.arquitectura) +
      calcular(antes.duplicacion, despues.duplicacion) +
      calcular(antes.complejidad, despues.complejidad)
    ) / 3
  };
}

export function interpretarMejora(metricas) {

  const valores = Object.values(metricas);
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

  if (promedio >= 70) return "Alta calidad";
  if (promedio >= 40) return "Calidad media";

  return "Baja calidad";
}

//valido el formato
export function validarFormato(resumen) {
  const texto = resumen.toLowerCase();

  return (
    /#+\s*arquitectura/.test(texto) &&
    /#+\s*duplicaci[oó]n de c[oó]digo/.test(texto) &&
    /#+\s*complejidad/.test(texto) &&
    /#+\s*organizaci[oó]n/.test(texto) &&
    /#+\s*buenas prácticas/.test(texto)
  );
}

//Esto es para darle formato a la respuesta de la IA
export function normalizarResumen(texto) {
  return texto
    .replace(/severidad/gi, "SEVERIDAD") // corrige variaciones
    .replace(/#+\s*arquitectura/gi, "### Arquitectura")
    .replace(/#+\s*duplicaci[oó]n de c[oó]digo/gi, "### Duplicación de Código")
    .replace(/#+\s*complejidad/gi, "### Complejidad")
    .replace(/#+\s*organizaci[oó]n/gi, "### Organización")
    .replace(/#+\s*buenas prácticas/gi, "### Buenas prácticas");
}

export function normalizarMetricas(metricas, totalArchivos) {

  const maximos = {
    arquitectura: totalArchivos * 4,      
    duplicacion: totalArchivos * 10,
    complejidad: totalArchivos * 20,
    organizacion: totalArchivos * 300,
    buenasPracticas: totalArchivos * 10
  };

  return {
    arquitectura: Math.min((metricas.arquitectura / maximos.arquitectura) * 100, 100),
    duplicacion: Math.min((metricas.duplicacion / maximos.duplicacion) * 100, 100),
    complejidad: Math.min((metricas.complejidad / maximos.complejidad) * 100, 100),
    organizacion: Math.min((metricas.organizacion / maximos.organizacion) * 100, 100),
    buenasPracticas: Math.min((metricas.buenasPracticas / maximos.buenasPracticas) * 100, 100)
  };
}

export function calcularMejora(antes, despues) {

  const mejora = {};

  for (let key in antes) {
    const valorAntes = antes[key];
    const valorDespues = despues[key];

    mejora[key] = Number(Math.max(0, valorAntes - valorDespues).toFixed(2));
  }

  mejora.promedio =
    Number((
      Object.values(mejora).reduce((a, b) => a + b, 0) /
      Object.keys(mejora).length
    ).toFixed(2));

  return mejora;
}

export function extraerMetricasFinales(resumen) {

  const get = (regex) => {
    const match = resumen.match(regex);
    return match ? Number(match[1]) : 0;
  };

  return {
    arquitectura: get(/Arquitectura:\s*(\d+)%/i),
    duplicacion: get(/Duplicaci[oó]n.*:\s*(\d+)%/i),
    complejidad: get(/Complejidad:\s*(\d+)%/i),
    organizacion: get(/Organizaci[oó]n:\s*(\d+)%/i),
    buenasPracticas: get(/Buenas prácticas:\s*(\d+)%/i)
  };
}

export function iniciarCronometro(){
  return Date.now();
}

export function finalizarCronometro(inicio){
  const tiempo = Date.now();
  const tiempoMedido = tiempo - inicio;
  return {
    ms: tiempoMedido,
    segundos: Number((tiempoMedido / 1000).toFixed(2))
  };

}