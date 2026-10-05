import React, { useEffect, useRef, useState } from "react";
import { Zap, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { redeemCode } from "../lib/redeem";
import { formatTime } from "../lib/helpers";
import { Button } from "./ui";

// Auto-redeem follows the same countdown shown under a disabled Redeem button:
// once enabled, it redeems the oldest available code whenever Redeem unlocks,
// until no codes are left.
export default function AutoRedeemPanel({ pending, member, members, codes, canRedeem, unlockSeconds, onDone }) {
  const storeKey = `auto_redeem_${member.id}`;
  const [enabled, setEnabled] = useState(() => localStorage.getItem(storeKey) === "1");
  const busy = useRef(false);
  const lastRun = useRef(0);

  function save(on) {
    setEnabled(on);
    if (on) localStorage.setItem(storeKey, "1"); else localStorage.removeItem(storeKey);
  }

  useEffect(() => {
    if (!enabled || busy.current) return;
    if (pending.length === 0) {
      save(false);
      toast.success("Auto-redeem finished — no more codes available.");
      return;
    }
    // cooldown lets fresh data arrive after a redeem before checking the lock again
    if (!canRedeem || Date.now() - lastRun.current < 15000) return;
    busy.current = true;
    const oldest = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    redeemCode(oldest, member, members, codes)
      .then(r => toast.success(`Auto-redeem: ${r.message}`))
      .catch(err => toast.error(`Auto-redeem failed: ${err.message || "error"}`))
      .finally(() => {
        lastRun.current = Date.now();
        onDone?.();
        busy.current = false;
      });
  }, [enabled, canRedeem, pending, unlockSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  function enable() {
    if (pending.length === 0) return toast.error("You need available codes to enable auto-redeem.");
    save(true);
    toast.success("Auto-redeem enabled.");
  }

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">Auto-Redeem</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Redeems your available codes automatically, one each time the Redeem countdown finishes. Keep the app open for it to run.
      </p>
      {enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {canRedeem ? "Redeeming…" : `Next code in ${formatTime(unlockSeconds)}`} · {pending.length} code{pending.length === 1 ? "" : "s"} queued
          </p>
          <Button size="sm" variant="outline" onClick={() => save(false)}>Disable Auto-Redeem</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
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
