import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Thermometer,
  Droplet,
  Power,
  Wifi,
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  Play,
  Square,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BrokerConfig, RelayStatus, DHTReading, LogMessage } from "./types";
import RelayCard from "./components/RelayCard";
import VoiceController from "./components/VoiceController";
import MQTTLogPanel from "./components/MQTTLogPanel";
import ArduinoExporter from "./components/ArduinoExporter";

export default function App() {
  // 1. MQTT Broker configurations
  const [brokers, setBrokers] = useState<BrokerConfig[]>([
    {
      id: "mosquitto",
      name: "Mosquitto Test Broker",
      url: "wss://test.mosquitto.org:8081/mqtt",
      connected: false,
      connecting: false,
      topicPrefix: "rumah/iot"
    },
    {
      id: "eclipse",
      name: "Eclipse Projects Broker",
      url: "wss://mqtt.eclipseprojects.io/mqtt", // secure port standard webpath
      connected: false,
      connecting: false,
      topicPrefix: "rumah/iot"
    },
    {
      id: "shiftr",
      name: "Shiftr.io Public Sandbox",
      url: "wss://broker.shiftr.io", // will connect using username/password try/try
      connected: false,
      connecting: false,
      topicPrefix: "rumah/iot"
    }
  ]);

  // 2. Relay Statuses
  const [relays, setRelays] = useState<RelayStatus[]>([
    { id: 1, label: "Relay 1", appliance: "Lampu Teras Utama", status: false, pin: 13, icon: "lightbulb" },
    { id: 2, label: "Relay 2", appliance: "Kipas Angin Ruang Tamu", status: false, pin: 12, icon: "fan" },
    { id: 3, label: "Relay 3", appliance: "Pompa Air Hidroponik", status: false, pin: 14, icon: "droplet" },
    { id: 4, label: "Relay 4", appliance: "Pendingin Ruang / AC", status: false, pin: 27, icon: "layers" }
  ]);

  // 3. Sensor Readings
  const [currentReading, setCurrentReading] = useState<DHTReading>({
    temperature: 28.5,
    humidity: 62.0,
    timestamp: new Date().toLocaleTimeString()
  });

  // History for trend visualization
  const [history, setHistory] = useState<DHTReading[]>([]);

  // 4. Client MQTT logs
  const [logs, setLogs] = useState<LogMessage[]>([]);

  // 5. Simulation States
  const [isSimulatingHardware, setIsSimulatingHardware] = useState(true);
  const [simTemp, setSimTemp] = useState(28.5);
  const [simHum, setSimHum] = useState(62.0);
  const [activePattern, setActivePattern] = useState<number | null>(null);

  const [currentTime, setCurrentTime] = useState("");

  // Refs for managing native MQTT clients
  const clientsRef = useRef<{ [key: string]: any }>({});
  const intervalPublishRef = useRef<any>(null);

  // UTC clock stream
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("id-ID", { timeZone: "UTC" }) + " (UTC)");
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // System logging helper
  const addLog = (
    brokerId: string,
    brokerName: string,
    topic: string,
    payload: string,
    type: "inbound" | "outbound" | "system"
  ) => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      brokerId,
      brokerName,
      topic,
      payload,
      type
    };
    setLogs((prev) => {
      // Limit to max 150 entries to keep browser performant
      const sliced = prev.length > 150 ? prev.slice(prev.length - 150) : prev;
      return [...sliced, newLog];
    });
  };

  // 6. Connect to all 3 brokers
  useEffect(() => {
    const checkMQTT = setInterval(() => {
      const mqttLib = (window as any).mqtt;
      if (mqttLib) {
        clearInterval(checkMQTT);
        initMQTTConnections(mqttLib);
      }
    }, 500);

    return () => {
      clearInterval(checkMQTT);
      disconnectAll();
    };
  }, []);

  const disconnectAll = () => {
    Object.keys(clientsRef.current).forEach((key) => {
      try {
        clientsRef.current[key].end();
      } catch (e) {
        console.error("Disconnect Error:", e);
      }
    });
    clientsRef.current = {};
    if (intervalPublishRef.current) clearInterval(intervalPublishRef.current);
  };

  const initMQTTConnections = (mqtt: any) => {
    brokers.forEach((broker) => {
      if (clientsRef.current[broker.id]) return; // already exists

      setBrokers((prev) =>
        prev.map((b) => (b.id === broker.id ? { ...b, connecting: true, error: undefined } : b))
      );

      let options: any = {
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000,
        clean: true
      };

      // Configuration payload for Shiftr.io instance using default credentials
      if (broker.id === "shiftr") {
        options.username = "try";
        options.password = "try";
        options.clientId = `dashboard-shiftr-${Math.random().toString(16).substr(2, 6)}`;
      } else {
        options.clientId = `dashboard-${broker.id}-${Math.random().toString(16).substr(2, 6)}`;
      }

      addLog(broker.id, broker.name, "Sistem", `Menghubungkan ke ${broker.url}...`, "system");

      try {
        const client = mqtt.connect(broker.url, options);

        client.on("connect", () => {
          setBrokers((prevOriginal) =>
            prevOriginal.map((b) =>
              b.id === broker.id ? { ...b, connected: true, connecting: false } : b
            )
          );
          addLog(broker.id, broker.name, "Sistem", "Berhasil terhubung ke Broker!", "system");

          // Subscribe to standard controls
          const parentTopic = broker.topicPrefix;
          client.subscribe(`${parentTopic}/temp`);
          client.subscribe(`${parentTopic}/humidity`);
          client.subscribe(`${parentTopic}/relay1`);
          client.subscribe(`${parentTopic}/relay2`);
          client.subscribe(`${parentTopic}/relay3`);
          client.subscribe(`${parentTopic}/relay4`);
          client.subscribe(`${parentTopic}/pattern`);
        });

        client.on("message", (topic: string, message: any) => {
          const payload = message.toString();
          addLog(broker.id, broker.name, topic, payload, "inbound");

          // Process payload
          handleIncomingMQTTMessage(topic, payload);
        });

        client.on("error", (err: any) => {
          console.error(`MQTT Error on broker ${broker.id}:`, err);
          setBrokers((prev) =>
            prev.map((b) =>
              b.id === broker.id
                ? { ...b, connected: false, connecting: false, error: err.message }
                : b
            )
          );
          addLog(broker.id, broker.name, "Sistem Error", `Kesalahan: ${err.message}`, "system");
        });

        client.on("close", () => {
          setBrokers((prevOriginal) =>
            prevOriginal.map((b) =>
              b.id === broker.id ? { ...b, connected: false, connecting: false } : b
            )
          );
        });

        clientsRef.current[broker.id] = client;
      } catch (err: any) {
        setBrokers((prevOriginal) =>
          prevOriginal.map((b) =>
            b.id === broker.id
              ? { ...b, connected: false, connecting: false, error: err.message }
              : b
          )
        );
        addLog(broker.id, broker.name, "Koneksi Gagal", err.message, "system");
      }
    });
  };

  // Re-connect specifically trigger
  const forceReconnectBroker = (id: string) => {
    const mqttLib = (window as any).mqtt;
    if (!mqttLib) return;

    if (clientsRef.current[id]) {
      try {
        clientsRef.current[id].end();
      } catch {}
      delete clientsRef.current[id];
    }
    const brokerToReconnect = brokers.filter((b) => b.id === id);
    if (brokerToReconnect.length > 0) {
      initMQTTConnections(mqttLib);
    }
  };

  // Handle incoming MQTT messages
  const handleIncomingMQTTMessage = (topic: string, payload: string) => {
    // 1. Temperature Reads
    if (topic.endsWith("/temp")) {
      const tempVal = parseFloat(payload);
      if (!isNaN(tempVal)) {
        setCurrentReading((prev) => ({
          ...prev,
          temperature: tempVal,
          timestamp: new Date().toLocaleTimeString()
        }));
      }
    }
    // 2. Humidity Reads
    else if (topic.endsWith("/humidity")) {
      const humVal = parseFloat(payload);
      if (!isNaN(humVal)) {
        setCurrentReading((prev) => ({
          ...prev,
          humidity: humVal,
          timestamp: new Date().toLocaleTimeString()
        }));
      }
    }
    // 3. Relay Toggles
    else if (topic.endsWith("/relay1")) {
      const status = payload === "ON" || payload === "1";
      setRelays((prev) => prev.map((r) => (r.id === 1 ? { ...r, status } : r)));
    } else if (topic.endsWith("/relay2")) {
      const status = payload === "ON" || payload === "1";
      setRelays((prev) => prev.map((r) => (r.id === 2 ? { ...r, status } : r)));
    } else if (topic.endsWith("/relay3")) {
      const status = payload === "ON" || payload === "1";
      setRelays((prev) => prev.map((r) => (r.id === 3 ? { ...r, status } : r)));
    } else if (topic.endsWith("/relay4")) {
      const status = payload === "ON" || payload === "1";
      setRelays((prev) => prev.map((r) => (r.id === 4 ? { ...r, status } : r)));
    }
    // 4. Special Relay Patterns
    else if (topic.endsWith("/pattern")) {
      const patternId = parseInt(payload);
      if (patternId === 1 || patternId === 2) {
        triggerSimulatedPatternAnimation(patternId);
      }
    }
  };

  // Add dht reading to trend history
  useEffect(() => {
    setHistory((prev) => {
      const updated = [...prev, currentReading];
      return updated.length > 12 ? updated.slice(updated.length - 12) : updated;
    });
  }, [currentReading.timestamp]);

  // Publish Outgoing MQTT Actions to ALL connected brokers
  const publishToAllBrokers = (topicPart: string, payload: string) => {
    brokers.forEach((broker) => {
      const client = clientsRef.current[broker.id];
      if (client && broker.connected) {
        const fullTopic = `${broker.topicPrefix}/${topicPart}`;
        client.publish(fullTopic, payload);
        addLog(broker.id, broker.name, fullTopic, payload, "outbound");
      }
    });
  };

  // Local Action Trigger from web cards
  const handleToggleRelayLocal = (id: number, targetStatus: boolean) => {
    setRelays((prev) => prev.map((r) => (r.id === id ? { ...r, status: targetStatus } : r)));
    const payload = targetStatus ? "ON" : "OFF";
    publishToAllBrokers(`relay${id}`, payload);
  };

  const handleToggleAllRelays = (targetStatus: boolean) => {
    setRelays((prev) => prev.map((r) => ({ ...r, status: targetStatus })));
    const payload = targetStatus ? "ON" : "OFF";
    publishToAllBrokers("relay1", payload);
    publishToAllBrokers("relay2", payload);
    publishToAllBrokers("relay3", payload);
    publishToAllBrokers("relay4", payload);
  };

  // Triggering the Combination Logic Patterns
  const handleTriggerPattern = (patternId: number) => {
    publishToAllBrokers("pattern", patternId.toString());
    triggerSimulatedPatternAnimation(patternId);
  };

  const triggerSimulatedPatternAnimation = (patternId: number) => {
    if (activePattern) return; // wait for completion

    setActivePattern(patternId);
    addLog("system", "Simulasi Hardware", "Pola", `Memulai logika variasi ${patternId}`, "system");

    if (patternId === 1) {
      // Variasi 1: Sequential Chase Left to Right, then Right to Left
      let step = 0;
      const sequence = [
        [true, false, false, false],
        [true, true, false, false],
        [true, true, true, false],
        [true, true, true, true],
        [false, true, true, true],
        [false, false, true, true],
        [false, false, false, true],
        [false, false, false, false]
      ];

      const interval = setInterval(() => {
        if (step < sequence.length) {
          const currentStep = sequence[step];
          setRelays((prev) =>
            prev.map((r, i) => ({ ...r, status: currentStep[i] }))
          );
          step++;
        } else {
          clearInterval(interval);
          setActivePattern(null);
        }
      }, 400);
    } else {
      // Variasi 2: Strobe Alert Flasher (Alternating groups 1&3 vs 2&4)
      let flashes = 0;
      const interval = setInterval(() => {
        if (flashes < 8) {
          const isOdd = flashes % 2 === 0;
          setRelays((prev) => [
            { ...prev[0], status: isOdd },
            { ...prev[1], status: !isOdd },
            { ...prev[2], status: isOdd },
            { ...prev[3], status: !isOdd }
          ]);
          flashes++;
        } else {
          clearInterval(interval);
          // Reset all OFF
          setRelays((prev) => prev.map((r) => ({ ...r, status: false })));
          setActivePattern(null);
        }
      }, 300);
    }
  };

  // Auto Hardware Simulator Loop
  // Publishes dht simulated values every 5s if active, acting like real micro ESP32
  useEffect(() => {
    if (isSimulatingHardware) {
      intervalPublishRef.current = setInterval(() => {
        // Add random micro-fluctuations to make simulation organic
        const fuzzyTemp = parseFloat((simTemp + (Math.random() * 0.4 - 0.2)).toFixed(1));
        const fuzzyHum = parseFloat((simHum + (Math.random() * 0.8 - 0.4)).toFixed(1));

        publishToAllBrokers("temp", fuzzyTemp.toString());
        publishToAllBrokers("humidity", fuzzyHum.toString());
      }, 5000);
    } else {
      if (intervalPublishRef.current) {
        clearInterval(intervalPublishRef.current);
      }
    }

    return () => {
      if (intervalPublishRef.current) clearInterval(intervalPublishRef.current);
    };
  }, [isSimulatingHardware, simTemp, simHum]);

  return (
    <div className="min-h-screen pb-12 font-sans overflow-x-hidden antialiased bg-zinc-950 text-zinc-100">
      {/* Upper Subtle Ambient Lights */}
      <div className="absolute top-0 left-1/4 h-80 w-1/2 -translate-y-40 rounded-full bg-emerald-500/5 blur-[130px]" />
      <div className="absolute top-40 right-10 h-60 w-60 rounded-full bg-cyan-500/5 blur-[100px]" />

      {/* Header Panel */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-zinc-950 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-zinc-100 text-lg tracking-tight uppercase">
                ARDUINO MULTI-BROKER TERMINAL
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                FW_VERSION: 1.2.4-STABLE • MULTI-BROKER CONNECTIVITY • INTERFACE EMERALD
              </p>
            </div>
          </div>

          {/* Time, MQTT Nodes Status in Header */}
          <div className="flex flex-wrap items-center gap-4 bg-zinc-950/45 p-2.5 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 border-r border-zinc-800 pr-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono text-zinc-300">{currentTime}</span>
            </div>
            
            {/* Multi-node compact states indicator */}
            <div className="flex gap-1.5 items-center">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mr-1">Nodes:</span>
              {brokers.map((b) => (
                <div 
                  key={b.id} 
                  className={`flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-full border text-[10px] ${
                    b.connected ? "border-emerald-500/35" : "border-zinc-800"
                  }`}
                  title={b.name}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${b.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="font-medium text-zinc-400 capitalize">{b.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= LEFT SIDEBAR / COLUMNS 1 ================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Broker Cards */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
              <Layers className="h-5 w-5 text-emerald-400" />
              <h3 className="font-sans font-medium text-zinc-100 text-sm">Status MQTT Gateway</h3>
            </div>
            <div className="space-y-3">
              {brokers.map((broker) => (
                <div
                  key={broker.id}
                  className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 flex items-center justify-between"
                >
                  <div className="truncate pr-3">
                    <h4 className="text-xs font-semibold text-zinc-200 truncate">{broker.name}</h4>
                    <span className="font-mono text-[9px] text-zinc-500 truncate block">
                      {broker.url}
                    </span>
                    {broker.error && (
                      <span className="text-[9px] text-red-400 font-mono block truncate">
                        Err: {broker.error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${
                        broker.connected
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                          : broker.connecting
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse"
                          : "bg-red-500/10 text-red-500 border border-red-500/15"
                      }`}
                    >
                      {broker.connected ? "ON" : broker.connecting ? "CONNECT..." : "OFF"}
                    </span>
                    <button
                      onClick={() => forceReconnectBroker(broker.id)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Sambung Ulang"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Sensors Metrics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3" style={{ contentVisibility: "auto" }}>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
                <h3 className="font-sans font-medium text-zinc-100 text-sm">Sensor Pembacaan dht</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Live climate feeds</span>
            </div>

            {/* Metrics Rows */}
            <div className="grid grid-cols-2 gap-4">
              {/* Temp Card */}
              <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-xl text-center">
                <p className="text-xs text-zinc-500 uppercase mb-2">Temperature</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-emerald-400 font-mono">
                    {currentReading.temperature}
                  </span>
                  <span className="text-lg text-zinc-500">°C</span>
                </div>
              </div>

              {/* Humidity Card */}
              <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-xl text-center">
                <p className="text-xs text-zinc-500 uppercase mb-2">Humidity</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-cyan-400 font-mono">
                    {currentReading.humidity}
                  </span>
                  <span className="text-lg text-zinc-500">%</span>
                </div>
              </div>
            </div>

            {/* Simple Dynamic SVG Trend Chart */}
            <div className="mt-4 bg-zinc-950/40 p-3 rounded-xl border border-zinc-850">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">
                Grafik Tren DHT Suhu Real-time:
              </p>
              <div className="h-16 flex items-end gap-1 px-1">
                {history.length === 0 ? (
                  <div className="flex-1 text-center text-[10px] text-zinc-650 h-full flex items-center justify-center">
                    Menunggu aliran data dari MQTT...
                  </div>
                ) : (
                  history.map((h, i) => {
                    const pct = Math.min(Math.max((h.temperature - 15) / 25, 0.1), 1) * 100; // mapped 15C-40C
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full bg-zinc-800 rounded-t h-12 flex items-end overflow-hidden">
                          <div
                            style={{ height: `${pct}%` }}
                            className="bg-emerald-500/50 group-hover:bg-emerald-400 w-full transition-all duration-300"
                          />
                        </div>
                        <span className="text-[8px] text-zinc-500 font-mono">{h.temperature}°</span>

                        {/* Hover Tooltip */}
                        <div className="absolute bottom-16 bg-zinc-900 border border-emerald-500/30 rounded p-1 text-[9px] text-zinc-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                          {h.timestamp} • {h.temperature}°C {h.humidity}%
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Interactive Simulated Device Control Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="font-sans font-medium text-zinc-100 text-sm">Simulasi Hardware</h3>
                  <p className="text-[10px] text-zinc-500">Uji fungsionalitas tanpa board fisik</p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulatingHardware(!isSimulatingHardware)}
                className={`text-[9.5px] uppercase font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isSimulatingHardware
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700"
                }`}
              >
                {isSimulatingHardware ? "AKTIF" : "NONAKTIF"}
              </button>
            </div>

            <div className={`space-y-4 ${isSimulatingHardware ? "opacity-100" : "opacity-45 pointer-events-none"}`}>
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-zinc-400">Simulate Temperatur:</span>
                  <span className="text-zinc-100 font-bold">{simTemp}°C</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="42"
                  step="0.5"
                  value={simTemp}
                  onChange={(e) => {
                    setSimTemp(parseFloat(e.target.value));
                    publishToAllBrokers("temp", e.target.value);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-zinc-400">Simulate Kelembapan:</span>
                  <span className="text-zinc-100 font-bold">{simHum}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="95"
                  step="1"
                  value={simHum}
                  onChange={(e) => {
                    setSimHum(parseFloat(e.target.value));
                    publishToAllBrokers("humidity", e.target.value);
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="text-[10px] text-zinc-500 leading-normal bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800">
                <span className="font-bold text-zinc-400 font-sans">Info:</span> Slider simulasi di atas menerbitkan paket data dht ke <strong>3 broker MQTT sekaligus</strong> setiap 5 detik secara bersamaan.
              </div>
            </div>
          </div>
        </div>

        {/* ================= MAIN CONTENT COLUMNS 2 ================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Actuator Relay Grid */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-4 mb-5 gap-3">
              <div>
                <span className="text-zinc-500 text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1 block">Relay Matrix</span>
                <h3 className="font-sans font-light text-zinc-100 text-3xl">Hardware Control Center</h3>
              </div>

              {/* Global control buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  id="btn-all-on"
                  onClick={() => handleToggleAllRelays(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase cursor-pointer transition-colors border border-zinc-700"
                >
                  ALL ON
                </button>
                <button
                  id="btn-all-off"
                  onClick={() => handleToggleAllRelays(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-400 text-xs font-bold uppercase cursor-pointer transition-colors border border-zinc-900"
                >
                  ALL OFF
                </button>
              </div>
            </div>

            {/* Actuator Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  onToggle={handleToggleRelayLocal}
                  brokerCount={brokers.filter((b) => b.connected).length}
                />
              ))}
            </div>

            {/* System Logics / Logic Combinations Options */}
            <div className="mt-6 pt-5 border-t border-zinc-800">
              <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold block mb-3 font-mono">
                pola kombinasi kontrol sistem (variasi logika)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pattern 1 button */}
                <button
                  id="btn-pattern-1"
                  disabled={activePattern !== null}
                  onClick={() => handleTriggerPattern(1)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    activePattern === 1
                      ? "bg-zinc-850 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 disabled:opacity-50"
                  }`}
                >
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Play className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-normal text-zinc-200">
                      Sequential Sweep Running (Kiri ke Kanan)
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">
                      Menghidupkan relay sekuensial bergantian dari Relay 1 ke 4 berurutan, lalu mematikan terbalik dari 4 ke 1.
                    </p>
                  </div>
                </button>

                {/* Pattern 2 button */}
                <button
                  id="btn-pattern-2"
                  disabled={activePattern !== null}
                  onClick={() => handleTriggerPattern(2)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    activePattern === 2
                      ? "bg-zinc-850 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 disabled:opacity-50"
                  }`}
                >
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Play className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-normal text-zinc-200">
                      Strobo Flasher Alert (Kelompok Silang)
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">
                      Flash Relay secara silang bergantian (Kelompok 1 & 3 ON, Kelompok 2 & 4 OFF), meniru lampu strobo.
                    </p>
                  </div>
                </button>
              </div>

              {activePattern && (
                <div className="mt-3 text-[10px] font-mono text-cyan-400 animate-pulse bg-cyan-950/20 py-1.5 px-3 rounded-lg border border-cyan-850">
                  ⚠️ Pola logika {activePattern} sedang berjalan di browser dan memancarkan data MQTT ke broker Anda...
                </div>
              )}
            </div>
          </div>

          {/* Voice Command Module */}
          <VoiceController
            currentReading={currentReading}
            onToggleRelay={handleToggleRelayLocal}
            onToggleAllRelays={handleToggleAllRelays}
            onTriggerPattern={handleTriggerPattern}
            onAddSystemLog={(text) => addLog("voice", "AI Voice Controller", "NLP", text, "system")}
          />

          {/* MQTT Live Terminal Logs */}
          <MQTTLogPanel
            logs={logs}
            onClearLogs={() => setLogs([])}
            brokers={brokers.map((b) => ({ id: b.id, name: b.name, connected: b.connected }))}
          />

          {/* Arduino Code Exporter */}
          <ArduinoExporter />
        </div>
      </main>

      {/* Footer credits */}
      <footer className="mt-16 border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">System Secured</span>
            </div>
            <span className="text-[10px] text-zinc-650 border-l border-zinc-800 pl-6 uppercase tracking-widest">Powered by Google AI Studio</span>
          </div>
          <div className="text-zinc-600 text-[10px] font-mono tracking-tighter">
            ID: MQTT_HUB_019283 // CRC: 0xF43A // NO_HIVEMQ_NO_EMQX_POLICY: ENABLED
          </div>
        </div>
      </footer>
    </div>
  );
}
