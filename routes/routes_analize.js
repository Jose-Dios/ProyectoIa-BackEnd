import express from "express";
import multer from "multer";
import {
  analizar,
  chat,
  historial,
  analizarProyectoIA,
  obtenerConversacion,
  eliminarConversacion
} from "../controllers/controllerIA.js";


export default function crearRouterAnalisis(db) {

  const router = express.Router();

  const upload = multer({ storage: multer.memoryStorage() });

  //Actua como capa intermedia entre la peticion HTTP y los controladores, pasando req, res y db a los controladores
  router.post("/analizar", (req,res)=>analizar(req,res,db));
  router.post("/chat", (req,res)=>chat(req,res,db));
  router.get("/historial", (req,res)=>historial(req,res,db));
  router.post("/analizar-proyecto",upload.array("archivos"), (req, res) => analizarProyectoIA(req, res, db));
  router.get("/historial/:id",(req,res)=>obtenerConversacion(req,res,db));
  router.delete("/eliminar/:id",(req,res)=>eliminarConversacion(req,res,db));
  
  return router;
}
