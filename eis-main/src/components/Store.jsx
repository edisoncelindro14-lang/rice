import React, { useState } from "react";
import { motion } from "framer-motion";
import { Store as StoreIcon, Ticket, Calendar, Copy, Key, X, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { formatDate, maintenanceStatus } from "../lib/helpers";
import { storeQuotaSummary, generateStoreCodes } from "../lib/storeQuota";
import { redeemCodeForMember } from "../lib/redeem";
import StoreAvailableCodes from "./StoreAvailableCodes";
import { Button, Input, Label, Badge } from "./ui";

export default function Store() {
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: quotas = [] } = useTable("store_code_quotas");
  const { data: redemptionHistory = [], refetch: refetchHistory } = useTable("code_redemption_history");
  const { currentMember } = useCurrentMember(members);
  const [count, setCount] = useState("1");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [redeemModal, setRedeemModal] = useState(null);
  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemUsername, setRedeemUsername] = useState("");
  const [phonebookVersion, setPhonebookVersion] = useState(0);
  const [genSearch, setGenSearch] = useState("");

  if (!currentMember) return <div className="p-10 text-center text-gray-400">Loading...</div>;
  if (currentMember.role !== "store") return <div className="p-10 text-center text-gray-500">This page is only for Store accounts.</div>;

  const q = storeQuotaSummary(currentMember.id, quotas, codes);
  const usernames = members.filter(m => m.status === "approved").map(m => m.username);
  const genSearchQ = genSearch.trim().toLowerCase();
  const filteredGeneratedCodes = genSearchQ
    ? q.generatedCodes.filter(c => (c.assigned_username || "").toLowerCase().includes(genSearchQ))
    : q.generatedCodes;

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
      setPhonebookVersion(v => v + 1);
    } catch { toast.error("Failed to generate codes"); }
    setBusy(false);
  }

  function openRedeemModal() {
    const target = redeemUsername.trim().replace(/^@/, "");
    if (!target) { toast.error("Select a username"); return; }
    const member = members.find(m => m.username === target);
    if (!member) { toast.error("Username not found"); return; }
    const status = maintenanceStatus(member, codes);
    if (status.isGreen && status.secondsLeft > 0) {
      const h = Math.floor(status.secondsLeft / 3600);
      const m = Math.floor((status.secondsLeft % 3600) / 60);
      toast.error(`Cannot redeem — maintenance cycle still active (${h}h ${m}m remaining)`);
      return;
    }
    setRedeemModal(member);
    setRedeemCodeInput("");
  }

  async function handleRedeemForMember() {
    if (!redeemModal || !redeemCodeInput.trim()) { toast.error("Enter a code"); return; }
    setRedeemBusy(true);
    try {
      const member = redeemModal;
      const { data: found, error } = await supabase
        .from("maintenance_codes").select("*").ilike("code", redeemCodeInput.replace(/[%_\\]/g, c => `\\${c}`)).eq("is_used", false).limit(1);
      if (error || !found?.length) { toast.error("Invalid or already used code"); setRedeemBusy(false); return; }
      const result = await redeemCodeForMember(found[0], member, members, codes);
      toast.success(result.message);
      setRedeemModal(null);
      setRedeemCodeInput("");
      setRedeemUsername("");
      refetchCodes();
      refetchHistory();
      setPhonebookVersion(v => v + 1);
    } catch (err) { toast.error(err.message || "Failed to redeem code"); }
    setRedeemBusy(false);
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

      {/* Available codes designated to members — searchable list */}
      <StoreAvailableCodes
        storeId={currentMember.id}
        members={members}
        codes={codes}
        refetchCodes={refetchCodes}
        refetchHistory={refetchHistory}
        onRedeemDone={() => setPhonebookVersion(v => v + 1)}
      />

      {/* Redeem code for a member */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Key className="w-5 h-5 text-teal-500" /> Redeem Code for Member</h2>
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label>Select member username</Label>
            <Input list="store-redeem-usernames" value={redeemUsername} onChange={e => setRedeemUsername(e.target.value)} placeholder="Search username..." />
            <datalist id="store-redeem-usernames">{usernames.map(u => <option key={u} value={u} />)}</datalist>
          </div>
          <Button onClick={openRedeemModal} className="bg-teal-500 hover:bg-teal-600 text-white h-10"><Key className="w-4 h-4" /> Redeem</Button>
        </div>
      </div>

      {/* Generated codes */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><Ticket className="w-5 h-5 text-amber-500" /> My Generated Codes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={genSearch} onChange={e => setGenSearch(e.target.value)} placeholder="Search by username…" className="pl-10" />
          </div>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-gray-100">{["Code", "Designated To", "Status", "Generated", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {filteredGeneratedCodes.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-gray-400">No codes found</td></tr> :
              filteredGeneratedCodes.map(c => (
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

      {/* Redeem Code Modal */}
      {redeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setRedeemModal(null); setRedeemCodeInput(""); setRedeemUsername(""); }}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Key className="w-5 h-5 text-teal-600" /> Redeem Code — {redeemModal.username}</h2>
              <button onClick={() => { setRedeemModal(null); setRedeemCodeInput(""); setRedeemUsername(""); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-sm text-teal-800">Enter a maintenance code to redeem on behalf of this member. Upline bonuses will be distributed automatically.</p>
              </div>
              <div>
                <Label>Maintenance Code</Label>
                <Input value={redeemCodeInput} onChange={e => setRedeemCodeInput(e.target.value)} placeholder="e.g. MAINT-XXXXXX" className="font-mono" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <Button onClick={() => { setRedeemModal(null); setRedeemCodeInput(""); setRedeemUsername(""); }} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={handleRedeemForMember} disabled={redeemBusy} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white">{redeemBusy ? "Redeeming..." : "Redeem Code"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
