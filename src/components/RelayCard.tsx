import React from "react";
import { Power, Flame, Lightbulb, Fan, Droplet, Layers } from "lucide-react";
import { motion } from "motion/react";
import { RelayStatus } from "../types";

interface RelayCardProps {
  key?: any;
  relay: RelayStatus;
  onToggle: (id: number, status: boolean) => void;
  brokerCount: number;
}

export default function RelayCard({ relay, onToggle, brokerCount }: RelayCardProps) {
  // Select appropriate icon
  const getIcon = (iconName: string, active: boolean) => {
    const classes = `h-6 w-6 transition-transform duration-300 ${active ? "scale-110" : ""}`;
    switch (iconName) {
      case "lightbulb":
        return <Lightbulb className={`${classes} ${active ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-zinc-500"}`} />;
      case "fan":
        return <Fan className={`${classes} ${active ? "text-cyan-400 animate-spin" : "text-zinc-500"}`} />;
      case "droplet":
        return <Droplet className={`${classes} ${active ? "text-cyan-400 animate-pulse" : "text-zinc-500"}`} />;
      default:
        return <Layers className={`${classes} ${active ? "text-emerald-400" : "text-zinc-500"}`} />;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className={`relative rounded-2xl p-5 border shadow-lg transition-all ${
        relay.status
          ? "bg-zinc-800/50 border-emerald-500 shadow-emerald-900/10"
          : "bg-zinc-950/50 border-zinc-800 shadow-zinc-950/5"
      }`}
    >
      {/* Glow Effect if status is ON */}
      {relay.status && (
        <div className="absolute inset-0 -z-10 rounded-2xl bg-emerald-500/5 blur-xl pointer-events-none" />
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl transition-all ${
            relay.status 
              ? "bg-emerald-500/15" 
              : "bg-zinc-950/60"
          }`}>
            {getIcon(relay.icon, relay.status)}
          </div>
          <div>
            <h4 className="font-sans font-medium text-zinc-100 text-sm">{relay.label}</h4>
            <span className="font-mono text-[10px] text-zinc-500">PIN GPIO {relay.pin}</span>
          </div>
        </div>

        {/* Tactical ON/OFF Switch */}
        <button
          onClick={() => onToggle(relay.id, !relay.status)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 outline-none ${
            relay.status ? "bg-emerald-500" : "bg-zinc-850"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ${
              relay.status ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 pt-3 border-t border-zinc-800/40 flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Power className={`h-3 w-3 ${relay.status ? "text-emerald-400" : "text-zinc-500"}`} />
          <span>Status</span>
        </div>
        <span className={`font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
          relay.status 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
            : "bg-zinc-950/60 text-zinc-500 border border-zinc-800/40"
        }`}>
          {relay.status ? "AKTIF (ON)" : "MATI (OFF)"}
        </span>
      </div>

      {/* Appliance Hint */}
      <div className="mt-2 text-[10px] text-zinc-500 font-mono">
        Beban: <span className="text-zinc-300 font-sans">{relay.appliance}</span>
      </div>
    </motion.div>
  );
}
