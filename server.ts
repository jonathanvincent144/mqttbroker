import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini AI Client safely
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini AI Client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Gemini AI client:", err);
  }
} else {
  console.warn("GEMINI_API_KEY is not set or using placeholder. AI voice command parsing will fall back to local rule-based system.");
}

// REST API for Voice Command Natural Language Processing
app.post("/api/voice-command", async (req, res) => {
  const { transcript, currentTemp, currentHumidity } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "Transcript is required" });
  }

  const normalizedText = transcript.toLowerCase();

  // Basic fallback rule-based system in case Gemini Client is unavailable
  const runFallbackRules = () => {
    let relay: number | null = null;
    let action: "ON" | "OFF" | "READ_SENSOR" | "PLAY_PATTERN" | "UNKNOWN" = "UNKNOWN";
    let patternId: number | null = null;
    let all = false;
    let responseText = "Maaf, perintah suara tidak dikenali.";

    // Match relays
    if (normalizedText.includes("relay 1") || normalizedText.includes("relay satu") || normalizedText.includes("saklar satu") || normalizedText.includes("saklar 1") || normalizedText.includes("lampu satu") || normalizedText.includes("lampu 1")) {
      relay = 1;
    } else if (normalizedText.includes("relay 2") || normalizedText.includes("relay dua") || normalizedText.includes("saklar dua") || normalizedText.includes("saklar 2") || normalizedText.includes("lampu dua") || normalizedText.includes("lampu 2") || normalizedText.includes("kipas")) {
      relay = 2;
    } else if (normalizedText.includes("relay 3") || normalizedText.includes("relay tiga") || normalizedText.includes("saklar tiga") || normalizedText.includes("saklar 3") || normalizedText.includes("lampu tiga") || normalizedText.includes("lampu 3") || normalizedText.includes("pompa")) {
      relay = 3;
    } else if (normalizedText.includes("relay 4") || normalizedText.includes("relay empat") || normalizedText.includes("saklar empat") || normalizedText.includes("saklar 4") || normalizedText.includes("lampu empat") || normalizedText.includes("lampu 4") || normalizedText.includes("pendingin")) {
      relay = 4;
    }

    // Match actions
    if (normalizedText.includes("nyalakan") || normalizedText.includes("hidupkan") || normalizedText.includes("on") || normalizedText.includes("buka")) {
      action = "ON";
      if (normalizedText.includes("semua")) {
        all = true;
        responseText = "Baik, menyalakan semua relay.";
      } else if (relay !== null) {
        responseText = `Baik, menyalakan relay nomor ${relay}.`;
      }
    } else if (normalizedText.includes("matikan") || normalizedText.includes("nonaktifkan") || normalizedText.includes("off") || normalizedText.includes("tutup")) {
      action = "OFF";
      if (normalizedText.includes("semua")) {
        all = true;
        responseText = "Baik, mematikan semua relay.";
      } else if (relay !== null) {
        responseText = `Baik, mematikan relay nomor ${relay}.`;
      }
    } else if (normalizedText.includes("suhu") || normalizedText.includes("kelembapan") || normalizedText.includes("sensor") || normalizedText.includes("temperatur") || normalizedText.includes("baca")) {
      action = "READ_SENSOR";
      responseText = `Hasil pembacaan sensor adalah: suhu ${currentTemp || 28} derajat Celsius, dan kelembapan ${currentHumidity || 60} persen.`;
    } else if (normalizedText.includes("pola") || normalizedText.includes("variasi") || normalizedText.includes("kombinasi") || normalizedText.includes("strobo") || normalizedText.includes("running")) {
      action = "PLAY_PATTERN";
      if (normalizedText.includes("running") || normalizedText.includes("satu") || normalizedText.includes("1") || normalizedText.includes("sekuensial") || normalizedText.includes("berurutan")) {
        patternId = 1;
        responseText = "Memulai variasi logika relay satu, yaitu sekuensial running dari kiri ke kanan.";
      } else {
        patternId = 2;
        responseText = "Memulai variasi logika relay dua, yaitu lampu strobo bergantian.";
      }
    }

    return { relay, action, patternId, all, response: responseText };
  };

  if (!aiClient) {
    const fallbackResult = runFallbackRules();
    return res.json(fallbackResult);
  }

  try {
    // Call Gemini to parse the command with high semantic accuracy
    const systemInstruction = `Anda adalah sistem kecerdasan buatan pengolah perintah suara bahasa Indonesia untuk sistem IoT Smart Home yang berisi 4 Relay (Relay 1, 2, 3, 4) dan sebuah sensor dht (suhu & kelembapan).
Format respon Anda harus selalu dalam bentuk JSON valid. Jangan gunakan backtick markdown, cukup kembalikan JSON mentah saja.
Struktur JSON yang dikembalikan harus mengikuti schema berikut:
{
  "relay": number | null (1 sampai 4 jika mengacu pada relay spesifik),
  "action": "ON" | "OFF" | "READ_SENSOR" | "PLAY_PATTERN" | "UNKNOWN",
  "patternId": number | null (1 jika pola running/sekuensial, 2 jika pola strobo/bergantian),
  "all": boolean (true jika meminta kontrol untuk semua relay sekaligus),
  "response": "Kalimat tanggapan suara santun dalam Bahasa Indonesia"
}

Petunjuk Tanggapan (response):
- Jika action 'READ_SENSOR', gunakan kalimat template seperti: "Ruangan saat ini memiliki suhu {suhu} derajat Celsius dengan kelembapan {kelembapan} persen."
- Jika relay tertentu dinyalakan/dimatikan, buat tanggapan suara yang spesifik, misalnya: "Siap, saklar tiga telah dinyalakan."
- Berikan respon yang natural dan bervariasi sesuai konteks kalimat user.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Pengguna berkata: "${transcript}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    const textOutput = response.text?.trim() || "{}";
    let parsedResult;
    try {
      parsedResult = JSON.parse(textOutput);
    } catch {
      // Clean possible JSON wrap markers in case
      let cleaned = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    // Replace sensor placeholders in spoken response if the action is READ_SENSOR
    if (parsedResult.action === "READ_SENSOR" && parsedResult.response) {
      const tempVal = currentTemp !== undefined ? currentTemp : 27.5;
      const humVal = currentHumidity !== undefined ? currentHumidity : 62;
      parsedResult.response = parsedResult.response
        .replace(/{suhu}/g, tempVal.toString())
        .replace(/{kelembapan}/g, humVal.toString());
    }

    return res.json(parsedResult);
  } catch (error) {
    console.error("Gemini voice interpretation failed, using local rules:", error);
    const fallbackResult = runFallbackRules();
    return res.json(fallbackResult);
  }
});

// Configure Vite integration or Static file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
