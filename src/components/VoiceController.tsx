import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DHTReading } from "../types";

interface VoiceControllerProps {
  currentReading: DHTReading;
  onToggleRelay: (id: number, status: boolean) => void;
  onToggleAllRelays: (status: boolean) => void;
  onTriggerPattern: (patternId: number) => void;
  onAddSystemLog: (text: string) => void;
}

export default function VoiceController({
  currentReading,
  onToggleRelay,
  onToggleAllRelays,
  onTriggerPattern,
  onAddSystemLog,
}: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Web Speech API tidak didukung oleh browser Anda. Gunakan Chrome atau Edge.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "id-ID"; // Default to Indonesian

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript("Mendengarkan...");
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error", event);
      if (event.error === "not-allowed") {
        setError("Izin mikrofon ditolak. Aktifkan izin mikrofon di browser Anda.");
      } else {
        setError(`Kesalahan suara: ${event.error}`);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = async (event: any) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);
      onAddSystemLog(`[Voice] Mengolah suara: "${resultText}"`);
      await processVoiceCommand(resultText);
    };

    recognitionRef.current = rec;
    synthRef.current = window.speechSynthesis;
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start voice recognition", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;

    // Direct stop any currently speaking audio
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID"; // Speak Indonesian

    // Find a premium Indonesian voice if available
    const voices = synthRef.current.getVoices();
    const indonesianVoice = voices.find((v) => v.lang.includes("ID") || v.lang.includes("id"));
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }

    utterance.rate = 1.05; // Slightly faster for natural feel
    synthRef.current.speak(utterance);
  };

  const processVoiceCommand = async (inputText: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: inputText,
          currentTemp: currentReading.temperature,
          currentHumidity: currentReading.humidity,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal menghubungi AI Server.");
      }

      const data = await response.json();
      console.log("Gemini voice response parsed:", data);

      if (data.response) {
        setAssistantResponse(data.response);
        speakText(data.response);
        onAddSystemLog(`[AI Asisten] "${data.response}"`);
      }

      // Execute appropriate component actions
      if (data.action === "ON") {
        if (data.all) {
          onToggleAllRelays(true);
        } else if (data.relay) {
          onToggleRelay(data.relay, true);
        }
      } else if (data.action === "OFF") {
        if (data.all) {
          onToggleAllRelays(false);
        } else if (data.relay) {
          onToggleRelay(data.relay, false);
        }
      } else if (data.action === "PLAY_PATTERN" && data.patternId) {
        onTriggerPattern(data.patternId);
      }
    } catch (err: any) {
      setError("Gagal mengurai perintah via AI. Menggunakan pencocokan lokal...");
      onAddSystemLog(`[Voice Error] Gagal memproses: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleCommands = [
    "\"Nyalakan kipas angin\" (Relay 2)",
    "\"Matikan lampu satu\" (Relay 1)",
    "\"Nyalakan semua saklar\"",
    "\"Suhu ruangan saat ini berapa?\"",
    "\"Mulai variasi logika strobo\"",
  ];

  return (
    <div id="voice-control" className="bg-zinc-900 border border-zinc-805 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-sans font-medium text-zinc-100 text-base">Asisten Perintah Suara</h3>
            <p className="text-xs text-zinc-500">Kendali cerdas alami berbasis AI Gemini & TTS</p>
          </div>
        </div>
        <div className="flex gap-1">
          <span className="inline-flex items-center py-0.5 px-2 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            ID Bahasa
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Main Mic Interface */}
      <div className="flex flex-col items-center justify-center py-6">
        <div className="relative">
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.4, 0.1, 0.4], scale: [1, 1.6, 1] }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="absolute inset-0 rounded-full bg-emerald-500/30"
              />
            )}
            {isProcessing && (
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute -inset-1 rounded-full border-t-2 border-zinc-500 border-r-2 border-transparent"
              />
            )}
          </AnimatePresence>

          <button
            id="mic-btn"
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-colors cursor-pointer ${
              isListening
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold"
            } ${isProcessing ? "opacity-75 cursor-not-allowed" : ""}`}
            title="Klik untuk berbicara"
          >
            {isListening ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-zinc-950" />}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs font-medium text-zinc-300">
            {isListening
              ? "Silakan bicara..."
              : isProcessing
              ? "Memproses suara dengan Gemini AI..."
              : "Klik microphone lalu mulai berbicara"}
          </p>
          <p className="text-sm font-semibold text-emerald-400 max-w-sm mt-2 italic line-clamp-2 min-h-5">
            {transcript && `"${transcript}"`}
          </p>
        </div>
      </div>

      {/* Spoken feedback section */}
      {assistantResponse && (
        <div className="mt-2 bg-zinc-950/60 rounded-xl p-4 border border-zinc-800">
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block mb-1">
            Asisten Berkata:
          </span>
          <p className="text-xs text-zinc-200 leading-relaxed font-mono">
            {assistantResponse}
          </p>
        </div>
      )}

      {/* Guide Helper */}
      <div className="mt-5 border-t border-zinc-800/60 pt-4">
        <span className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium mb-2">
          <HelpCircle className="h-3.5 w-3.5 text-emerald-400" /> Contoh Kalimat Perintah:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {sampleCommands.map((command, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTranscript(command.replace(/"/g, "").split(" (")[0]);
                onAddSystemLog(`[Demo] Simulasi suara: ${command}`);
                processVoiceCommand(command.replace(/"/g, "").split(" (")[0]);
              }}
              className="text-left text-[11px] text-zinc-400 bg-zinc-950/40 border border-zinc-800 hover:border-emerald-500/30 hover:bg-emerald-500/5 p-2 rounded-lg transition-colors cursor-pointer"
            >
              {command}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
