import React, { useState } from "react";
import { motion } from "framer-motion";
import { Store as StoreIcon, Ticket, Calendar, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember } from "../lib/useData";
import { formatDate } from "../lib/helpers";
import { storeQuotaSummary, generateStoreCodes } from "../lib/storeQuota";
import StorePhonebook from "./StorePhonebook";
import { Button, Input, Label, Badge } from "./ui";

export default function Store() {
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: quotas = [] } = useTable("store_code_quotas");
  const { currentMember } = useCurrentMember(members);
  const [count, setCount] = useState("1");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  if (!currentMember) return <div className="p-10 text-center text-gray-400">Loading...</div>;
  if (currentMember.role !== "store") return <div className="p-10 text-center text-gray-500">This page is only for Store accounts.</div>;

  const q = storeQuotaSummary(currentMember.id, quotas, codes);
  const usernames = members.filter(m => m.status === "approved").map(m => m.username);

  async function generate() {
    const n = parseInt(count) || 0;
    const target = username.trim().replace(/^@/, "");
    if (n < 1) { toast.error("Enter a valid number of codes"); return; }
    if (n > q.remaining) { toast.error(`You can only generate ${q.remaining} more code(s)`); return; }
    if (target && !usernames.includes(target)) { toast.error("Username not found"); return; }
    setBusy(true);
    try {
      await generateStoreCodes(currentMember.id, n, target);
      toast.success(`${n} code(s) generated!`);
      setCount("1");
      setUsername("");
      refetchCodes();
    } catch { toast.error("Failed to generate codes"); }
    setBusy(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl"><StoreIcon className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Panel</h1>
          <p className="text-gray-500">Generate maintenance codes within the limit set by the admin</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Allotted by Admin", value: q.allotted, color: "from-amber-500 to-orange-600" },
          { label: "Generated", value: q.generated, color: "from-blue-500 to-indigo-600" },
          { label: "Remaining", value: q.remaining, color: "from-teal-500 to-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl mb-3`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Generate */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Ticket className="w-5 h-5 text-teal-500" /> Generate Codes</h2>
        <div className="grid sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
          <div>
            <Label>Number of codes</Label>
            <Input type="number" min="1" max={q.remaining} value={count} onChange={e => setCount(e.target.value)} />
          </div>
          <div>
            <Label>Designate to username (optional)</Label>
            <Input list="store-usernames" value={username} onChange={e => setUsername(e.target.value)} placeholder="Leave blank for unassigned" />
            <datalist id="store-usernames">{usernames.map(u => <option key={u} value={u} />)}</datalist>
          </div>
          <Button onClick={generate} disabled={busy || q.remaining < 1} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white h-10">{busy ? "Generating..." : "Generate"}</Button>
        </div>
        {q.remaining < 1 && <p className="text-sm text-red-500 mt-3">No remaining codes. Ask the admin to add more.</p>}
      </div>

      {/* Phonebook — add usernames and send available codes */}
      <StorePhonebook storeId={currentMember.id} members={members} codes={codes} refetchCodes={refetchCodes} />

      {/* Allotments from admin */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" /> Codes Added by Admin</h2></div>
        <table className="w-full">
          <thead><tr className="border-b border-gray-100">{["Date", "Codes Added"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody>
            {q.allotments.length === 0 ? <tr><td colSpan="2" className="text-center py-10 text-gray-400">No codes allotted yet</td></tr> :
            q.allotments.map(a => (
              <tr key={a.id} className="border-b border-gray-50">
                <td className="px-6 py-3 text-sm text-gray-600">{formatDate(a.created_date)}</td>
                <td className="px-6 py-3 text-sm font-semibold text-emerald-700">+{a.quota_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generated codes */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> My Generated Codes</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">{["Code", "Designated To", "Status", "Generated", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {q.generatedCodes.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-gray-400">No codes generated yet</td></tr> :
              q.generatedCodes.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono font-bold text-gray-900">
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }} className="inline-flex items-center gap-1 hover:text-teal-600">{c.code} <Copy className="w-3 h-3" /></button>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "Unassigned"}</td>
                  <td className="px-6 py-3"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
