//Se realiza la conexion a la BD 

import { MongoClient } from "mongodb";
import "dotenv/config";

const url = process.env.BD_LINK;
const client = new MongoClient(url);

let dbInstance = null; //evitar multiples conexiones

export async function conectarDB() {

  if (dbInstance) return dbInstance;

  await client.connect();
  console.log("Conectado a MongoDB");

  dbInstance = client.db();
  return dbInstance;
}