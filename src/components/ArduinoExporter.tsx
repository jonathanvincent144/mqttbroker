import React, { useState } from "react";
import { Cpu, Copy, Check, Download, AlertTriangle, Settings, Code } from "lucide-react";
import { ArduinoOptions } from "../types";

export default function ArduinoExporter() {
  const [copied, setCopied] = useState(false);
  const [boardType, setBoardType] = useState<"ESP32" | "ESP8266">("ESP32");
  const [dhtType, setDhtType] = useState<"DHT11" | "DHT22">("DHT22");
  const [ssid, setSsid] = useState("WiFi_SSID_Kamu");
  const [pass, setPass] = useState("Wifi_Password_Kamu");
  const [dhtPin, setDhtPin] = useState(4);
  const [relay1Pin, setRelay1Pin] = useState(13);
  const [relay2Pin, setRelay2Pin] = useState(12);
  const [relay3Pin, setRelay3Pin] = useState(14);
  const [relay4Pin, setRelay4Pin] = useState(27);

  const [topicPrefix, setTopicPrefix] = useState("rumah/iot");

  // Dynamic code generator based on user inputs
  const generateArduinoCode = () => {
    const isESP32 = boardType === "ESP32";
    const wifiLib = isESP32 ? "#include <WiFi.h>" : "#include <ESP8266WiFi.h>";

    return `/**
 * SKETCH ARDUINO AUTOMATED FOR ${boardType}
 * DHT Sensor & 4 Channel Relay Multi-MQTT connectivity
 * 3 MQTT Broker redundancy configuration (Mosquitto, Eclipse Projects, MQTTHQ)
 * [PENTING] Tidak menggunakan HiveMQ maupun EMQX.
 */

${wifiLib}
#include <PubSubClient.h> // Library oleh Nick O'Leary (cari di Library Manager)
#include "DHT.h"          // Library oleh Adafruit

// ================= KRIDENSIAL WIFI =================
const char* ssid = "${ssid}";
const char* password = "${pass}";

// ================= DETAIL MQTT BROKER (3 Broker Berbeda) =================
// Broker 1: Eclipse Mosquitto
const char* mqtt_server_1   = "test.mosquitto.org";
const int mqtt_port_1       = 1883;

// Broker 2: Eclipse Projects
const char* mqtt_server_2   = "mqtt.eclipseprojects.io";
const int mqtt_port_2       = 1883;

// Broker 3: MQTTHQ Public Broker
const char* mqtt_server_3   = "public.mqtthq.com";
const int mqtt_port_3       = 1883;

// ================= PIN OUT HARDWARE & DHT =================
#define DHTPIN ${dhtPin}
#define DHTTYPE ${dhtType}

#define RELAY1 ${relay1Pin}
#define RELAY2 ${relay2Pin}
#define RELAY3 ${relay3Pin}
#define RELAY4 ${relay4Pin}

// ================= TOPIC CONFIGURATION =================
const char* topic_temp      = "${topicPrefix}/temp";
const char* topic_hum       = "${topicPrefix}/humidity";
const char* topic_relay1    = "${topicPrefix}/relay1";
const char* topic_relay2    = "${topicPrefix}/relay2";
const char* topic_relay3    = "${topicPrefix}/relay3";
const char* topic_relay4    = "${topicPrefix}/relay4";
const char* topic_pattern   = "${topicPrefix}/pattern";

// ================= DEKLARASI CLIENT =================
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient1;
WiFiClient espClient2;
WiFiClient espClient3;

PubSubClient client1(espClient1);
PubSubClient client2(espClient2);
PubSubClient client3(espClient3);

unsigned long lastSendTime = 0;
const long interval = 5000; // Kirim dht data setiap 5 detik

// State status relay
bool statusRelay1 = false;
bool statusRelay2 = false;
bool statusRelay3 = false;
bool statusRelay4 = false;

// Prototip Fungsi callback
void callback(char* topic, byte* payload, unsigned int length);

void setup() {
  Serial.begin(115200);
  delay(10);
  
  // Konfigurasi pin relay sebagai output
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  
  // Set default Relay mati (biasanya Relay active low, ubah HIGH jika active-low)
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);

  // Inisialisasi sensor DHT
  dht.begin();
  
  // Memulai koneksi WiFi
  setup_wifi();

  // Memasang Server Broker pada masing-masing client
  client1.setServer(mqtt_server_1, mqtt_port_1);
  client1.setCallback(callback);

  client2.setServer(mqtt_server_2, mqtt_port_2);
  client2.setCallback(callback);

  client3.setServer(mqtt_server_3, mqtt_port_3);
  client3.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

// Fungsi reconnect untuk mendukung 3 broker redundansi
void reconnectClients() {
  // Hubungkan ulang Client Broker 1
  if (!client1.connected()) {
    Serial.print("Menghubungkan ke Broker 1 (Mosquitto)...");
    String clientId = "WiFiClient-${boardType}-1-" + String(random(0, 10000));
    if (client1.connect(clientId.c_str())) {
      Serial.println("terhubung!");
      // Subscribe ke topik control
      client1.subscribe(topic_relay1);
      client1.subscribe(topic_relay2);
      client1.subscribe(topic_relay3);
      client1.subscribe(topic_relay4);
      client1.subscribe(topic_pattern);
    } else {
      Serial.print("gagal, rc=");
      Serial.println(client1.state());
    }
  }

  // Hubungkan ulang Client Broker 2
  if (!client2.connected()) {
    Serial.print("Menghubungkan ke Broker 2 (Eclipse IoT)...");
    String clientId = "WiFiClient-${boardType}-2-" + String(random(0, 10000));
    if (client2.connect(clientId.c_str())) {
      Serial.println("terhubung!");
      client2.subscribe(topic_relay1);
      client2.subscribe(topic_relay2);
      client2.subscribe(topic_relay3);
      client2.subscribe(topic_relay4);
      client2.subscribe(topic_pattern);
    } else {
      Serial.print("gagal, rc=");
      Serial.println(client2.state());
    }
  }

  // Hubungkan ulang Client Broker 3
  if (!client3.connected()) {
    Serial.print("Menghubungkan ke Broker 3 (MQTTHQ)...");
    String clientId = "WiFiClient-${boardType}-3-" + String(random(0, 10000));
    if (client3.connect(clientId.c_str())) {
      Serial.println("terhubung!");
      client3.subscribe(topic_relay1);
      client3.subscribe(topic_relay2);
      client3.subscribe(topic_relay3);
      client3.subscribe(topic_relay4);
      client3.subscribe(topic_pattern);
    } else {
      Serial.print("gagal, rc=");
      Serial.println(client3.state());
    }
  }
}

// Pola Logika Variasi Relay 1: Berurutan (Sequential Chasel)
void mainkanPolaSekuensial() {
  Serial.println("[Logika Variasi 1] Menjalankan pola sekuensial running...");
  int pins[] = {RELAY1, RELAY2, RELAY3, RELAY4};
  
  // Hidupkan dari kiri ke kanan
  for(int i=0; i<4; i++) {
    digitalWrite(pins[i], LOW); // LOW = Nyala pada modul relay active low
    delay(300);
  }
  // Matikan dari kanan ke kiri
  for(int i=3; i>=0; i--) {
    digitalWrite(pins[i], HIGH); // HIGH = Mati
    delay(300);
  }
}

// Pola Logika Variasi 2: StroboWarning
void mainkanPolaStrobo() {
  Serial.println("[Logika Variasi 2] Menjalankan pola Strobo...");
  for(int iterasi=0; iterasi<6; iterasi++) {
    // Relay 1 & 3 ON, Relay 2 & 4 OFF
    digitalWrite(RELAY1, LOW);
    digitalWrite(RELAY3, LOW);
    digitalWrite(RELAY2, HIGH);
    digitalWrite(RELAY4, HIGH);
    delay(150);
    
    // Relay 1 & 3 OFF, Relay 2 & 4 ON
    digitalWrite(RELAY1, HIGH);
    digitalWrite(RELAY3, HIGH);
    digitalWrite(RELAY2, LOW);
    digitalWrite(RELAY4, LOW);
    delay(150);
  }
  
  // Kembalikan ke state semua OFF
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);
}

// Callback menangani pesan incoming MQTT dari broker mana saja
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Pesan masuk [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  // Parse Topik Kontrol Relay
  if (String(topic) == topic_relay1) {
    if (msg == "ON" || msg == "1") {
      digitalWrite(RELAY1, LOW); // Aktifkan
      statusRelay1 = true;
    } else {
      digitalWrite(RELAY1, HIGH); // matikan
      statusRelay1 = false;
    }
  } 
  else if (String(topic) == topic_relay2) {
    if (msg == "ON" || msg == "1") {
      digitalWrite(RELAY2, LOW);
      statusRelay2 = true;
    } else {
      digitalWrite(RELAY2, HIGH);
      statusRelay2 = false;
    }
  } 
  else if (String(topic) == topic_relay3) {
    if (msg == "ON" || msg == "1") {
      digitalWrite(RELAY3, LOW);
      statusRelay3 = true;
    } else {
      digitalWrite(RELAY3, HIGH);
      statusRelay3 = false;
    }
  } 
  else if (String(topic) == topic_relay4) {
    if (msg == "ON" || msg == "1") {
      digitalWrite(RELAY4, LOW);
      statusRelay4 = true;
    } else {
      digitalWrite(RELAY4, HIGH);
      statusRelay4 = false;
    }
  }
  // Parse Topik Logika Variasi
  else if (String(topic) == topic_pattern) {
    if (msg == "1") {
      mainkanPolaSekuensial();
    } else if (msg == "2") {
      mainkanPolaStrobo();
    }
  }
}

void loop() {
  // Re-koneksi client jika ada yang terputus
  if (WiFi.status() == WL_CONNECTED) {
    reconnectClients();
  }

  // Jalankan handler MQTT background
  if(client1.connected()) client1.loop();
  if(client2.connected()) client2.loop();
  if(client3.connected()) client3.loop();

  // Pengiriman Sensor dht berkala ke SEMUA broker aktif
  unsigned long now = millis();
  if (now - lastSendTime > interval) {
    lastSendTime = now;

    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (isnan(t) || isnan(h)) {
      Serial.println("Gagal membaca sensor DHT!");
      return;
    }

    Serial.print("Mengirim data DHT -> Suhu: ");
    Serial.print(t);
    Serial.print("C, Lembap: ");
    Serial.print(h);
    Serial.println("%");

    // Publikasi ke 3 broker berbeda sekaligus demi redundansi
    String rawTemp = String(t);
    String rawHum = String(h);

    if (client1.connected()) {
      client1.publish(topic_temp, rawTemp.c_str());
      client1.publish(topic_hum, rawHum.c_str());
    }
    if (client2.connected()) {
      client2.publish(topic_temp, rawTemp.c_str());
      client2.publish(topic_hum, rawHum.c_str());
    }
    if (client3.connected()) {
      client3.publish(topic_temp, rawTemp.c_str());
      client3.publish(topic_hum, rawHum.c_str());
    }
  }
}
`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateArduinoCode());
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDownload = () => {
    const code = generateArduinoCode();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `iot_mqtt_redundansi_dht_relay.ino`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="arduino-exporter" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
        <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-sans font-medium text-zinc-100 text-base">Eksportir Kode Arduino</h3>
          <p className="text-xs text-zinc-450 font-sans">Sesuaikan opsi hardware & download file .ino ke Arduino IDE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {/* Left column: options */}
        <div className="md:col-span-1 space-y-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2 font-mono">
            <Settings className="h-3.5 w-3.5" />
            <span>Konfigurasi Hardware</span>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium font-sans">Jenis Board Mikro</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setBoardType("ESP32")}
                className={`py-1.5 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  boardType === "ESP32"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/55 font-bold"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                ESP32 NodeMCU
              </button>
              <button
                onClick={() => setBoardType("ESP8266")}
                className={`py-1.5 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  boardType === "ESP8266"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/55 font-bold"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                ESP8266 D1 Mini
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1 font-medium font-sans">Sensor Suhu & Kelembapan</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setDhtType("DHT11")}
                className={`py-1.5 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  dhtType === "DHT11"
                    ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/55 font-bold"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                DHT11
              </button>
              <button
                onClick={() => setDhtType("DHT22")}
                className={`py-1.5 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  dhtType === "DHT22"
                    ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/55 font-bold"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                DHT22
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-800/60 pt-3">
            <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-2 font-mono">Koneksi WiFi Anda</span>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">SSID</span>
                <input
                  type="text"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">Password</span>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800/60 pt-3">
            <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-2 font-mono">Pemetaan Pin GPIO</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block">Pin DHT</span>
                <input
                  type="number"
                  value={dhtPin}
                  onChange={(e) => setDhtPin(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Relay 1</span>
                <input
                  type="number"
                  value={relay1Pin}
                  onChange={(e) => setRelay1Pin(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Relay 2</span>
                <input
                  type="number"
                  value={relay2Pin}
                  onChange={(e) => setRelay2Pin(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Relay 3</span>
                <input
                  type="number"
                  value={relay3Pin}
                  onChange={(e) => setRelay3Pin(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Relay 4</span>
                <input
                  type="number"
                  value={relay4Pin}
                  onChange={(e) => setRelay4Pin(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block">Target Prefix</span>
                <input
                  type="text"
                  value={topicPrefix}
                  onChange={(e) => setTopicPrefix(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: code display */}
        <div className="md:col-span-2 flex flex-col h-[400px] md:h-auto">
          <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-t-xl border border-zinc-800/80 border-b-0" style={{ contentVisibility: "auto" }}>
            <span className="text-xs font-mono font-medium text-zinc-400 flex items-center gap-1">
              <Code className="h-3.5 w-3.5 text-cyan-400" /> main_module.ino (Auto-Generated)
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-805 hover:border-zinc-700 hover:bg-zinc-800 py-1 px-3 rounded-lg text-zinc-300 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Tersalin" : "Salin"}</span>
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-xs bg-emerald-500 hover:bg-emerald-600 py-1 px-3 rounded-lg text-zinc-950 font-bold transition-colors cursor-pointer font-sans"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh File</span>
              </button>
            </div>
          </div>

          <pre className="flex-1 bg-zinc-950/90 border border-zinc-800 p-4 rounded-b-xl overflow-auto font-mono text-xs text-emerald-400/90 leading-relaxed shadow-inner">
            <code>{generateArduinoCode()}</code>
          </pre>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-xs text-zinc-300">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="space-y-1 leading-normal">
          <p className="font-semibold text-amber-400 font-sans">Informasi Broker & Redundansi:</p>
          <p>
            Mikrokontroler Anda akan terhubung ke <strong>3 Broker MQTT berbeda</strong> (Mosquitto, Eclipse Projects, MQTTHQ) sekaligus. Sistem ini redundan: jika salah satu broker gagal atau terputus, mikrokontroler Anda akan mencoba menghubungkan client broker lainnya, memproses topik secara bersamaan, dan mempublikasikan data DHT ke ketiganya demi menjamin keandalan data.
          </p>
        </div>
      </div>
    </div>
  );
}
