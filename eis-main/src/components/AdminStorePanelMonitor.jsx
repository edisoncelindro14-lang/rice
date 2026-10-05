import React, { useState } from "react";
import { Eye } from "lucide-react";
import { formatDate } from "../lib/helpers";
import { storeQuotaSummary } from "../lib/storeQuota";
import SearchableDropdown from "./SearchableDropdown";
import { Badge } from "./ui";

const storeLabel = s => `@${s.username} — ${s.full_name}`;

// Read-only view of what a store sees in its own Store Panel, for any store picked via search dropdown.
export default function AdminStorePanelMonitor({ storeMembers, codes, quotas }) {
  const [storeId, setStoreId] = useState("");
  const store = storeMembers.find(s => s.id === storeId);
  const q = store ? storeQuotaSummary(store.id, quotas, codes) : null;
  const th = h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden border-t-4 border-t-blue-500">
      <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-blue-500" /> Store Panel Monitor</h2>
        <div className="w-full sm:w-80">
          <SearchableDropdown
            value={store ? storeLabel(store) : ""}
            onChange={label => setStoreId(storeMembers.find(s => storeLabel(s) === label)?.id || "")}
            options={storeMembers.map(storeLabel)}
            placeholder="Select store to monitor..."
          />
        </div>
      </div>
      {!store ? (
        <p className="text-center py-10 text-gray-400">Select a store to view its Store Panel.</p>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[["Allotted by Admin", q.allotted], ["Generated", q.generated], ["Remaining", q.remaining]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-gray-100 p-4">
                <p className="text-2xl font-bold text-gray-900">{v}</p>
                <p className="text-sm text-gray-500">{l}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <p className="px-6 py-3 font-semibold text-gray-900 bg-gray-50">Codes Added by Admin</p>
            <div className="overflow-auto max-h-60"><table className="w-full">
              <thead><tr className="border-b border-gray-100">{["Date", "Codes Added"].map(th)}</tr></thead>
              <tbody>
                {q.allotments.length === 0 ? <tr><td colSpan="2" className="text-center py-6 text-gray-400">No codes allotted yet</td></tr> :
                q.allotments.map(a => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(a.created_date)}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-emerald-700">+{a.quota_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <p className="px-6 py-3 font-semibold text-gray-900 bg-gray-50">Generated Codes</p>
            <div className="overflow-auto max-h-96"><table className="w-full">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-gray-100">{["Code", "Designated To", "Status", "Generated", "Used Date"].map(th)}</tr></thead>
              <tbody>
                {q.generatedCodes.length === 0 ? <tr><td colSpan="5" className="text-center py-6 text-gray-400">No codes generated</td></tr> :
                q.generatedCodes.map(c => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-sm font-mono font-bold text-gray-900">{c.code}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "Unassigned"}</td>
                    <td className="px-6 py-3"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="px-6 py-3 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  );
}
