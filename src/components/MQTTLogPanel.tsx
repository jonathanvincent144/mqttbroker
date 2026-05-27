import React, { useState } from "react";
import { Terminal, Trash2, Filter, AlertCircle, RefreshCw } from "lucide-react";
import { LogMessage } from "../types";

interface MQTTLogPanelProps {
  logs: LogMessage[];
  onClearLogs: () => void;
  brokers: Array<{ id: string; name: string; connected: boolean }>;
}

export default function MQTTLogPanel({ logs, onClearLogs, brokers }: MQTTLogPanelProps) {
  const [filterBroker, setFilterBroker] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const filteredLogs = logs.filter((log) => {
    const matchesBroker = filterBroker === "all" || log.brokerId === filterBroker;
    const matchesType = filterType === "all" || log.type === filterType;
    return matchesBroker && matchesType;
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[480px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-zinc-800 pb-3" style={{ contentVisibility: "auto" }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Terminal className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-sans font-medium text-zinc-100 text-base">MQTT Live Console</h3>
            <p className="text-xs text-zinc-500 font-sans">Log transaksi data real-time pada 3 MQTT Broker sekaligus</p>
          </div>
        </div>
        <button
          onClick={onClearLogs}
          disabled={logs.length === 0}
          className="inline-flex items-center justify-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-350 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Hapus Log</span>
        </button>
      </div>

      {/* Connection States Bar */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800">
        {brokers.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5 justify-center py-1">
            <span className={`h-2 w-2 rounded-full ${b.connected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500 animate-pulse"}`} />
            <span className="text-[10px] sm:text-xs text-zinc-300 font-mono truncate">{b.name}</span>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-zinc-950/20 p-2 rounded-lg border border-zinc-800/50">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Filter className="h-3.5 w-3.5" />
          <span>Saring:</span>
        </div>

        {/* Broker Select Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Broker</span>
          <select
            value={filterBroker}
            onChange={(e) => setFilterBroker(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Broker</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Direction Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Tipe</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Arah</option>
            <option value="inbound">Inbound (Sensor DHT)</option>
            <option value="outbound">Outbound (Kontrol Relay)</option>
            <option value="system">System (Konektivitas)</option>
          </select>
        </div>

        {/* Total Badge */}
        <div className="ml-auto text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded font-mono">
          {filteredLogs.length} Baris Log
        </div>
      </div>

      {/* Terminal Display */}
      <div className="flex-1 bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 overflow-y-auto font-mono text-xs flex flex-col gap-2 shadow-inner min-h-0">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-650 gap-2">
            <AlertCircle className="h-8 w-8 text-zinc-700" />
            <p className="text-center font-sans">Belum ada aktivitas transaksi MQTT terpantau.</p>
          </div>
        ) : (
          filteredLogs.slice().reverse().map((log) => {
            let badgeBg = "bg-zinc-800 text-zinc-400";
            if (log.type === "inbound") badgeBg = "bg-blue-500/10 text-blue-400 border border-blue-500/15";
            if (log.type === "outbound") badgeBg = "bg-amber-500/10 text-amber-400 border border-amber-500/15";
            if (log.type === "system") badgeBg = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";

            return (
              <div key={log.id} className="border-b border-zinc-900 pb-2 flex flex-col gap-1 hover:bg-zinc-900/40 p-1 rounded transition-colors group">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-zinc-500 font-mono">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded uppercase font-bold text-[9px] ${badgeBg}`}>
                    {log.type}
                  </span>
                  <span className="text-emerald-400 hover:underline max-w-[150px] truncate" title={log.brokerName}>
                    @{log.brokerId}
                  </span>
                  <span className="text-zinc-400 font-bold ml-auto truncate tracking-wider max-w-[120px] sm:max-w-xs" title={log.topic}>
                    {log.topic}
                  </span>
                </div>
                <div className="text-xs text-zinc-300 bg-zinc-950/50 p-1.5 rounded border border-zinc-850/40 font-mono break-all whitespace-pre-wrap group-hover:bg-zinc-950">
                  {log.payload}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
