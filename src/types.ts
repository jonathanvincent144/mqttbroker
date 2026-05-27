export interface BrokerConfig {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  connecting: boolean;
  error?: string;
  topicPrefix: string;
}

export interface RelayStatus {
  id: number;
  label: string;
  appliance: string;
  status: boolean; // true = ON, false = OFF
  pin: number;
  icon: string;
}

export interface DHTReading {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  brokerId: string;
  brokerName: string;
  topic: string;
  payload: string;
  type: "inbound" | "outbound" | "system";
}

export interface ArduinoOptions {
  boardType: "ESP32" | "ESP8266";
  dhtType: "DHT11" | "DHT22";
  ssid: string;
  pass: string;
  dhtPin: number;
  relayPins: {
    relay1: number;
    relay2: number;
    relay3: number;
    relay4: number;
  };
  topics: {
    suhu: string;
    kelembapan: string;
    relay1: string;
    relay2: string;
    relay3: string;
    relay4: string;
    pattern: string;
  };
}
