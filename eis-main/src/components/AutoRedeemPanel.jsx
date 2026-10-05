import React, { useEffect, useRef, useState } from "react";
import { Zap, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { redeemCode } from "../lib/redeem";
import { formatTime } from "../lib/helpers";
import { Button } from "./ui";

// Same as the "Unlocks in" countdown on a disabled Redeem button: 12h cycle minus the 2h unlock window = 10h
const CYCLE_MS = 10 * 3600 * 1000;

const pad = n => String(n).padStart(2, "0");
const toTimeInput = ms => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;

// "HH:MM" -> next occurrence of that time (today, or tomorrow if already passed)
function nextOccurrence(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Auto-redeem: redeems one available code at the chosen start time, then one
// every 10 hours after the previous redeem, until no codes are left.
export default function AutoRedeemPanel({ pending, member, members, codes, onDone }) {
  const storeKey = `auto_redeem_${member.id}`;
  const [cfg, setCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storeKey)) || { enabled: false, nextAt: null }; }
    catch { return { enabled: false, nextAt: null }; }
  });
  const [startInput, setStartInput] = useState(() => toTimeInput(Date.now()));
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const latest = useRef({});
  latest.current = { pending, members, codes, cfg };

  function save(next) {
    setCfg(next);
    localStorage.setItem(storeKey, JSON.stringify(next));
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const { pending, members, codes, cfg } = latest.current;
    if (!cfg.enabled || busy.current || Date.now() < cfg.nextAt) return;
    if (pending.length === 0) {
      save({ enabled: false, nextAt: null });
      toast.success("Auto-redeem finished — no more codes available.");
      return;
    }
    busy.current = true;
    const oldest = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    redeemCode(oldest, member, members, codes)
      .then(r => toast.success(`Auto-redeem: ${r.message}`))
      .catch(err => toast.error(`Auto-redeem failed: ${err.message || "error"}`))
      .finally(() => {
        save({ enabled: true, nextAt: Date.now() + CYCLE_MS });
        onDone?.();
        busy.current = false;
      });
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  function enable() {
    if (pending.length === 0) return toast.error("You need available codes to enable auto-redeem.");
    if (!startInput) return toast.error("Set a valid start time.");
    const start = nextOccurrence(startInput);
    save({ enabled: true, nextAt: start });
    toast.success("Auto-redeem enabled.");
  }

  const secondsToNext = cfg.enabled ? Math.max(0, Math.ceil((cfg.nextAt - now) / 1000)) : 0;

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">Auto-Redeem</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Redeems your available codes automatically, one every 10 hours (when the Redeem button unlocks) starting at the time you set. Keep the app open for it to run.
      </p>
      {cfg.enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {secondsToNext > 0 ? `Next code in ${formatTime(secondsToNext)}` : "Redeeming…"} · {pending.length} code{pending.length === 1 ? "" : "s"} queued
          </p>
          <Button size="sm" variant="outline" onClick={() => save({ enabled: false, nextAt: null })}>Disable Auto-Redeem</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Start time (first 10-hour countdown)</span>
            <input
              type="time"
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
            />
          </label>
          <Button size="sm" disabled={pending.length === 0} onClick={enable}
            className={pending.length === 0 ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "!bg-amber-500 hover:!bg-amber-600 !text-white"}>
            Enable Auto-Redeem
          </Button>
          {pending.length === 0 && <p className="text-xs text-gray-400">No available codes.</p>}
        </div>
      )}
    </div>
  );
}
