import React, { useState } from "react";
import { Store, Search, Plus, Ticket, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/helpers";
import { storeQuotaSummary } from "../lib/storeQuota";
import { Button, Input, Label, Badge } from "./ui";

export default function AdminStoreTab({ approvedMembers, members, codes, quotas, currentMemberId, setRole, refetchQuotas }) {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [amount, setAmount] = useState("50");
  const [saving, setSaving] = useState(false);

  const storeMembers = approvedMembers.filter(m => m.role === "store");
  const nameOf = id => members.find(m => m.id === id)?.username || "—";

  const candidates = search
    ? approvedMembers.filter(m => m.role === "member" && [m.full_name, m.username, m.email].some(v => (v || "").toLowerCase().includes(search.toLowerCase()))).slice(0, 8)
    : [];

  async function addQuota() {
    const n = parseInt(amount) || 0;
    if (!storeId) { toast.error("Select a store first"); return; }
    if (n < 1) { toast.error("Enter a valid number of codes"); return; }
    setSaving(true);
    const { error } = await supabase.from("store_code_quotas").insert({ store_member_id: storeId, quota_amount: n, set_by_admin_id: currentMemberId });
    setSaving(false);
    if (error) { toast.error("Failed to add codes"); return; }
    toast.success(`${n} code(s) added to @${nameOf(storeId)}`);
    setAmount("50");
    refetchQuotas();
  }

  const history = [...quotas].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-6">
      {/* Promote members to Store */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 border-t-4 border-t-emerald-500">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Store className="w-5 h-5 text-emerald-500" /> Store Accounts</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Make an approved member a Store. Stores generate codes up to the number you allot.</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members to make Store..." className="pl-10" />
        </div>
        {candidates.map(m => (
          <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-800">{m.full_name} <span className="text-gray-500">@{m.username}</span></span>
            <Button onClick={() => setRole(m.id, "store")} size="sm" className="bg-emerald-600 text-white h-8 px-3 text-xs"><Store className="w-3 h-3 mr-1" /> Make Store</Button>
          </div>
        ))}
      </div>

      {/* Allot codes */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Plus className="w-5 h-5 text-teal-500" /> Add Codes to Store</h2>
        {storeMembers.length === 0 ? <p className="text-sm text-gray-400">No stores yet. Make a member a Store above.</p> : (
          <div className="grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
            <div>
              <Label>Store username</Label>
              <select value={storeId} onChange={e => setStoreId(e.target.value)} className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm">
                <option value="">Select store...</option>
                {storeMembers.map(s => <option key={s.id} value={s.id}>@{s.username} — {s.full_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Number of codes</Label>
              <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <Button onClick={addQuota} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white h-10">{saving ? "Adding..." : "Add Codes"}</Button>
          </div>
        )}
      </div>

      {/* Store overview */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> Store Overview</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Store", "Allotted", "Generated", "Remaining", "Last Added", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {storeMembers.length === 0 ? <tr><td colSpan="6" className="text-center py-10 text-gray-400">No stores yet</td></tr> :
              storeMembers.map(s => {
                const q = storeQuotaSummary(s.id, quotas, codes);
                return (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.full_name} <span className="text-gray-500">@{s.username}</span></td>
                    <td className="px-6 py-4 text-sm text-gray-700">{q.allotted}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{q.generated}</td>
                    <td className="px-6 py-4"><Badge className={q.remaining > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>{q.remaining}</Badge></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{q.allotments[0] ? formatDate(q.allotments[0].created_date) : "—"}</td>
                    <td className="px-6 py-4"><Button onClick={() => setRole(s.id, "member")} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs">Remove Store</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allotment history */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" /> Code Allotment History</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Date", "Store", "Codes Added", "Added By"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {history.length === 0 ? <tr><td colSpan="4" className="text-center py-10 text-gray-400">No codes allotted yet</td></tr> :
              history.map(h => (
                <tr key={h.id} className="border-b border-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{formatDate(h.created_date)}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">@{nameOf(h.store_member_id)}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-emerald-700">+{h.quota_amount}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">@{nameOf(h.set_by_admin_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
