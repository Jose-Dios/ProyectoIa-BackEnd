// El arranque usa import dinámico a propósito: los `import` estáticos se
// evalúan antes que cualquier try/catch, así que un fallo de configuración
// (una variable de entorno ausente) escaparía como un stack trace ilegible.
try {
  const { iniciarServidor } = await import("./servidor.js");

  await iniciarServidor();
} catch (error) {
  // Sin configuración ni base de datos no hay nada que servir: es preferible
  // morir a quedarse como un proceso vivo que responde 404 a todo.
  console.error("\nNo se pudo iniciar el servidor:");
  console.error(`  ${error.message}\n`);

  process.exit(1);
}
