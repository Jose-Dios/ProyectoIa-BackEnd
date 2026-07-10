import crypto from "crypto";

// Métricas OBJETIVAS, calculadas sobre el código con reglas deterministas.
//
// Se distinguen de las que devuelve la IA en el resumen: aquellas son una
// autoevaluación del modelo (subjetiva, no reproducible, no verificable). Estas
// se calculan igual siempre, sobre el código antes y después de refactorizar,
// y permiten afirmar si la refactorización mejoró algo de forma medible.
//
// Limitación conocida: son heurísticas léxicas, no un análisis del AST. Cuentan
// tokens sobre el texto del código, por lo que pueden contar palabras clave que
// aparezcan dentro de cadenas de texto.

// \b evita contar subcadenas dentro de identificadores: sin el límite de
// palabra, "notify" contaría un `if` y "format" un `for`.
const PALABRAS_DECISION = /\b(if|else\s+if|for|while|case|catch|\?\?)\b/g;
const OPERADORES_LOGICOS = /(&&|\|\||\?\.)/g;
const DECLARACION_FUNCION = /\b(function\b|=>)/g;

const LINEA_COMENTARIO = /^\s*(\/\/|\/\*|\*)/;
const VENTANA_DUPLICADO = 5; // líneas consecutivas que forman un bloque comparable

function lineasSignificativas(codigo) {
  return codigo
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "" && !LINEA_COMENTARIO.test(linea));
}

function contar(codigo, regex) {
  return (codigo.match(regex) ?? []).length;
}

// Complejidad ciclomática aproximada (McCabe): 1 + número de puntos de decisión.
export function complejidadCiclomatica(codigo) {
  return (
    1 +
    contar(codigo, PALABRAS_DECISION) +
    contar(codigo, OPERADORES_LOGICOS)
  );
}

// Porcentaje de líneas que pertenecen a un bloque de N líneas repetido en
// alguna otra parte del proyecto. Es la definición habitual de "código
// duplicado" en herramientas como PMD/CPD.
export function porcentajeDuplicacion(archivos) {
  const bloques = new Map();
  let totalBloques = 0;

  for (const archivo of archivos) {
    const lineas = lineasSignificativas(archivo.contenido);

    for (let i = 0; i + VENTANA_DUPLICADO <= lineas.length; i++) {
      const bloque = lineas.slice(i, i + VENTANA_DUPLICADO).join("\n");
      const hash = crypto.createHash("md5").update(bloque).digest("hex");

      bloques.set(hash, (bloques.get(hash) ?? 0) + 1);
      totalBloques++;
    }
  }

  if (totalBloques === 0) return 0;

  let bloquesDuplicados = 0;

  for (const repeticiones of bloques.values()) {
    if (repeticiones > 1) bloquesDuplicados += repeticiones;
  }

  return redondear((bloquesDuplicados / totalBloques) * 100);
}

function malasPracticas(codigo) {
  return (
    contar(codigo, /\bconsole\.log\b/g) +
    contar(codigo, /\bvar\s+\w/g) +
    // Igualdad no estricta: descarta === y !== mirando el carácter contiguo.
    contar(codigo, /[^=!<>]==[^=]/g) +
    contar(codigo, /!=[^=]/g)
  );
}

function redondear(valor) {
  return Number(valor.toFixed(2));
}

export function calcularMetricasCodigo(archivos) {
  if (archivos.length === 0) {
    return {
      archivos: 0,
      lineasCodigo: 0,
      complejidadTotal: 0,
      complejidadPromedioPorFuncion: 0,
      porcentajeDuplicacion: 0,
      densidadComentarios: 0,
      malasPracticas: 0,
    };
  }

  let lineasCodigo = 0;
  let lineasComentario = 0;
  let complejidadTotal = 0;
  let funciones = 0;
  let totalMalasPracticas = 0;

  for (const archivo of archivos) {
    const codigo = archivo.contenido;
    const todasLasLineas = codigo.split("\n").map((l) => l.trim()).filter(Boolean);

    lineasComentario += todasLasLineas.filter((l) => LINEA_COMENTARIO.test(l)).length;
    lineasCodigo += lineasSignificativas(codigo).length;
    complejidadTotal += complejidadCiclomatica(codigo);
    funciones += contar(codigo, DECLARACION_FUNCION);
    totalMalasPracticas += malasPracticas(codigo);
  }

  const lineasTotales = lineasCodigo + lineasComentario;

  return {
    archivos: archivos.length,
    lineasCodigo,
    complejidadTotal,
    complejidadPromedioPorFuncion: funciones > 0 ? redondear(complejidadTotal / funciones) : 0,
    porcentajeDuplicacion: porcentajeDuplicacion(archivos),
    densidadComentarios: lineasTotales > 0 ? redondear((lineasComentario / lineasTotales) * 100) : 0,
    malasPracticas: totalMalasPracticas,
  };
}

// Para todas estas métricas, un valor menor es mejor; salvo la densidad de
// comentarios, donde un aumento moderado se considera positivo.
const MENOR_ES_MEJOR = [
  "lineasCodigo",
  "complejidadTotal",
  "complejidadPromedioPorFuncion",
  "porcentajeDuplicacion",
  "malasPracticas",
];

export function compararMetricas(antes, despues) {
  const comparacion = {};

  for (const clave of MENOR_ES_MEJOR) {
    const valorAntes = antes[clave];
    const valorDespues = despues[clave];
    const diferencia = valorAntes - valorDespues;

    comparacion[clave] = {
      antes: valorAntes,
      despues: valorDespues,
      // Reducción porcentual respecto al valor original.
      mejoraPorcentual: valorAntes > 0 ? redondear((diferencia / valorAntes) * 100) : 0,
    };
  }

  comparacion.densidadComentarios = {
    antes: antes.densidadComentarios,
    despues: despues.densidadComentarios,
    mejoraPorcentual: redondear(despues.densidadComentarios - antes.densidadComentarios),
  };

  const promedio =
    MENOR_ES_MEJOR.reduce((suma, clave) => suma + comparacion[clave].mejoraPorcentual, 0) /
    MENOR_ES_MEJOR.length;

  comparacion.mejoraPromedio = redondear(promedio);

  return comparacion;
}
