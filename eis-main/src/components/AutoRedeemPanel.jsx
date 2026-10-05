import React, { useEffect, useRef, useState } from "react";
import { Zap, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useTable } from "../lib/useData";
import { redeemCode } from "../lib/redeem";
import { formatTime } from "../lib/helpers";

const CYCLE_MS = 24 * 3600 * 1000; // once a day
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

// Everyone redeems at the same admin-set time, but commissions only pay uplines whose own code is
// already active. So each member waits a short time proportional to their depth in the tree:
// uplines redeem first, downlines after, and the normal commission logic (unchanged) pays correctly.
const STEP_MS = 2000;
const MAX_WAIT_MS = 30000;
function treeDelay(member, members) {
  let depth = 0, cur = member;
  while (cur?.referrer_id && depth < 50) {
    cur = members.find(m => m.id === cur.referrer_id);
    if (cur) depth++;
  }
  return Math.min(depth * STEP_MS, MAX_WAIT_MS);
}

// Auto-redeem: redeems one available code at the chosen time of day, then again every
// day at the same clock time (e.g. 9:00 AM every day), until no codes are left.
export default function AutoRedeemPanel({ pending, member, members, codes, onDone }) {
  const storeKey = `auto_redeem_${member.id}`;
  const [cfg, setCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storeKey)) || { enabled: false, nextAt: null }; }
    catch { return { enabled: false, nextAt: null }; }
  });
  const { data: settings = [] } = useTable("system_settings");
  const adminTime = settings.find(x => x.setting_key === "auto_redeem_start_time")?.setting_value || "";
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

  // No buttons: whenever codes are available and the admin has set a start time, schedule starts automatically
  useEffect(() => {
    const { pending, members, codes, cfg } = latest.current;
    if (busy.current) return;
    if (pending.length === 0) {
      if (cfg.enabled) save({ enabled: false, nextAt: null });
      return;
    }
    if (!adminTime) return;
    if (!cfg.enabled) { save({ enabled: true, nextAt: nextOccurrence(adminTime) }); return; }
    if (Date.now() < cfg.nextAt) return;
    busy.current = true;
    const oldest = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    new Promise(res => setTimeout(res, treeDelay(member, members)))
      .then(() => redeemCode(oldest, member, members, codes))
      .then(r => toast.success(`Auto-redeem: ${r.message}`))
      .catch(err => toast.error(`Auto-redeem failed: ${err.message || "error"}`))
      .finally(() => {
        // keep the same clock time: advance the schedule in 24h steps, never drifting
        let next = latest.current.cfg.nextAt + CYCLE_MS;
        while (next <= Date.now()) next += CYCLE_MS;
        save({ enabled: true, nextAt: next });
        onDone?.();
        busy.current = false;
      });
  }, [now, adminTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondsToNext = cfg.enabled ? Math.max(0, Math.ceil((cfg.nextAt - now) / 1000)) : 0;

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">Auto-Redeem</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Redeems one available code automatically at the start time set by the admin, then again once a day at the same time. Keep the app open for it to run.
      </p>
      {cfg.enabled ? (
        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {secondsToNext > 0 ? `Next code at ${new Date(cfg.nextAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })} (in ${formatTime(secondsToNext)})` : "Redeeming…"} · {pending.length} code{pending.length === 1 ? "" : "s"} queued
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          {pending.length === 0 ? "No available codes." : "Waiting for the admin to set the auto-redeem start time."}
        </p>
      )}
    </div>
  );
}
