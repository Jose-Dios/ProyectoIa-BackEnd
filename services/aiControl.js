import axios from "axios";
import "dotenv/config";

let contadorIA = 0;
const LIMITE = 6;
const MODEL = process.env.MODELO;
const OLLAMA_URL = process.env.OLLAMA;
const DETENER = process.env.PAUSA;

async function reiniciarModelo() {
  try {
    console.log("Reiniciando modelo...");

    await fetch(DETENER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: MODEL })
    });

    // dejar respirar al sistema
    await new Promise(r => setTimeout(r, 1500));

  } catch (err) {
    console.error("Error reiniciando modelo:", err);
  }
}

export async function llamarIA({ prompt, messages }) {

  if (contadorIA >= LIMITE) {
    await reiniciarModelo();
    contadorIA = 0;
  }

  contadorIA++;

  const payload = {
    model: MODEL,
    stream: false
  };

  if (messages) {
    payload.messages = messages;
  } else {
    payload.messages = [
      { role: "user", content: prompt }
    ];
  }

  const response = await axios.post(OLLAMA_URL, payload);

  return response.data.message.content;
}