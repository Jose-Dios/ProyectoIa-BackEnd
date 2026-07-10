// Validación SEMÁNTICA del refactor: `node --check` garantiza que el archivo
// compila, pero no que siga sirviendo para lo mismo.
//
// Caso real observado con mistral:7b: renombró `agregarUsuario` a `addUser` y
// exportó `module.exports = { addUser }`. El archivo compila perfectamente,
// pero cualquier `require("./usuarios").agregarUsuario` acaba de romperse.
//
// Aquí se compara el "contrato" del módulo antes y después: qué nombres exporta
// y qué rutas HTTP declara. Si el refactor pierde alguno, no es un refactor.
//
// Limitación conocida: es análisis léxico, no del AST. Detecta las formas
// habituales de exportación, no construcciones dinámicas
// (`module.exports[clave] = ...`).

// Recorre el código carácter a carácter para separar el código real de las
// cadenas y los comentarios. Un regex ingenuo trataría el "//" de "http://x"
// como el inicio de un comentario.
function separarCodigoYCadenas(codigo) {
  let limpio = "";
  const cadenas = [];

  let i = 0;
  const n = codigo.length;

  while (i < n) {
    const c = codigo[i];
    const siguiente = codigo[i + 1];

    // Comentario de línea
    if (c === "/" && siguiente === "/") {
      while (i < n && codigo[i] !== "\n") i++;
      continue;
    }

    // Comentario de bloque
    if (c === "/" && siguiente === "*") {
      i += 2;
      while (i < n && !(codigo[i] === "*" && codigo[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // Cadena (comilla simple, doble o plantilla)
    if (c === '"' || c === "'" || c === "`") {
      const comilla = c;
      let contenido = "";

      i++;

      while (i < n && codigo[i] !== comilla) {
        if (codigo[i] === "\\") {
          contenido += codigo[i + 1] ?? "";
          i += 2;
          continue;
        }

        contenido += codigo[i];
        i++;
      }

      i++; // cierre
      cadenas.push(contenido);
      limpio += '""'; // marcador: preserva la sintaxis sin el contenido
      continue;
    }

    limpio += c;
    i++;
  }

  return { limpio, cadenas };
}

// Nombres que el módulo expone al exterior. Cubre CommonJS y ESM.
export function extraerExportaciones(codigo) {
  const { limpio } = separarCodigoYCadenas(codigo);
  const nombres = new Set();

  // module.exports = { a, b: c }
  const objetoExportado = limpio.match(/module\s*\.\s*exports\s*=\s*\{([^}]*)\}/);

  if (objetoExportado) {
    for (const parte of objetoExportado[1].split(",")) {
      // Con "b: c" el nombre público es "b"; con "a" a secas, es "a".
      const nombre = parte.split(":")[0].trim();

      if (/^[A-Za-z_$][\w$]*$/.test(nombre)) nombres.add(nombre);
    }
  } else if (/module\s*\.\s*exports\s*=/.test(limpio)) {
    // module.exports = algo  → el consumidor hace require(...)(...) sin nombre.
    nombres.add("default");
  }

  // module.exports.foo = ... / exports.foo = ...
  for (const m of limpio.matchAll(/(?:module\s*\.\s*)?exports\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g)) {
    nombres.add(m[1]);
  }

  // export function/class/const/let/var nombre
  for (const m of limpio.matchAll(
    /export\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
  )) {
    nombres.add(m[1]);
  }

  // export { a, b as c }  → los nombres públicos son "a" y "c"
  for (const m of limpio.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of m[1].split(",")) {
      const trozos = parte.trim().split(/\s+as\s+/);
      const nombre = (trozos[1] ?? trozos[0])?.trim();

      if (nombre && /^[A-Za-z_$][\w$]*$/.test(nombre)) nombres.add(nombre);
    }
  }

  if (/export\s+default\s/.test(limpio)) nombres.add("default");

  return nombres;
}

// Rutas HTTP declaradas como literales: "/usuarios", "/api/login".
// El prompt de refactorización prohíbe explícitamente cambiar endpoints.
export function extraerRutas(codigo) {
  const { cadenas } = separarCodigoYCadenas(codigo);

  return new Set(cadenas.filter((c) => /^\/[^\s]*$/.test(c) && c.length > 1));
}

// El contrato se rompe si DESAPARECE algo. Añadir exportaciones o rutas nuevas
// no rompe a ningún consumidor existente, así que no se penaliza.
export function validarContrato(original, refactorizado) {
  const exportacionesOriginales = extraerExportaciones(original);
  const exportacionesNuevas = extraerExportaciones(refactorizado);

  const rutasOriginales = extraerRutas(original);
  const rutasNuevas = extraerRutas(refactorizado);

  const exportacionesPerdidas = [...exportacionesOriginales].filter((n) => !exportacionesNuevas.has(n));
  const rutasPerdidas = [...rutasOriginales].filter((r) => !rutasNuevas.has(r));

  const valido = exportacionesPerdidas.length === 0 && rutasPerdidas.length === 0;

  const motivos = [];

  if (exportacionesPerdidas.length > 0) {
    motivos.push(`exportaciones que desaparecieron: ${exportacionesPerdidas.join(", ")}`);
  }

  if (rutasPerdidas.length > 0) {
    motivos.push(`rutas HTTP que desaparecieron: ${rutasPerdidas.join(", ")}`);
  }

  return {
    valido,
    exportacionesPerdidas,
    rutasPerdidas,
    motivo: motivos.join(" | "),
  };
}
