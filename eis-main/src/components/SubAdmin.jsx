import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ArrowRight, Ticket, Store as StoreIcon, Plus, X } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { formatDate, money, maintenanceStatus, formatTime, generateReferralCode } from "../lib/helpers";
import { supabase } from "../lib/supabase";
import { Button, Badge } from "./ui";
import toast from "react-hot-toast";

export default function SubAdmin() {
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: storeQuotas = [], refetch: refetchQuotas } = useTable("store_code_quotas");
  const { currentMember } = useCurrentMember(members);

  const [genCount, setGenCount] = useState("1");
  const [assignUsername, setAssignUsername] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const approvedMembers = useMemo(() => members.filter(m => m.status === "approved"), [members]);

  const myQuota = storeQuotas.find(q => q.store_member_id === currentMember?.id);
  const myCodes = codes.filter(c => c.assigned_sub_admin_id === currentMember?.id);
  const generatedCount = myCodes.length;
  const quotaAmount = myQuota?.quota_amount || 0;
  const remaining = quotaAmount - generatedCount;

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <StoreIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Store Panel</h1>
          <p className="text-gray-600 mb-6">Please login to access the store panel.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  async function generateStoreCodes() {
    const count = parseInt(genCount) || 1;
    if (count < 1) { toast.error("Enter a valid count"); return; }
    if (count > remaining) { toast.error(`Only ${remaining} codes remaining in your quota`); return; }
    setGenerating(true);
    try {
      const records = [];
      for (let i = 0; i < count; i++) {
        const base = "MAINT-" + generateReferralCode();
        const code = assignUsername ? `${base}-@${assignUsername.toUpperCase()}` : base;
        records.push({
          code,
          is_used: false,
          assigned_username: assignUsername || null,
          assigned_sub_admin_id: currentMember.id,
        });
      }
      await supabase.from("maintenance_codes").insert(records);

      // Update generated_count in quota
      if (myQuota) {
        await supabase.from("store_code_quotas").update({
          generated_count: (myQuota.generated_count || 0) + count,
        }).eq("id", myQuota.id);
      }

      toast.success(`${count} code(s) generated!`);
      setGenCount("1");
      setAssignUsername("");
      setAssignedSearch("");
      refetchCodes();
      refetchQuotas();
    } catch { toast.error("Failed to generate codes"); }
    setGenerating(false);
  }

  const managedMembers = members.filter(m => m.referrer_id === currentMember.id);
  const unusedCodes = myCodes.filter(c => !c.is_used);
  const transferredCodes = myCodes.filter(c => c.assigned_username);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
            <StoreIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Store Panel</h1>
            <p className="text-gray-500">Generate and manage maintenance codes within your quota</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Code Quota", value: quotaAmount, color: "from-amber-500 to-orange-600" },
          { label: "Generated", value: generatedCount, color: "from-blue-500 to-indigo-600" },
          { label: "Remaining", value: remaining, color: "from-teal-500 to-emerald-600" },
          { label: "Managed Members", value: managedMembers.length, color: "from-purple-500 to-pink-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl mb-3`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quota info with dates */}
      {myQuota && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-sm text-teal-800 flex flex-wrap gap-6">
          <span>Quota set: <strong>{formatDate(myQuota.set_date, "MMM d, yyyy h:mm a")}</strong></span>
          <span>Last updated: <strong>{formatDate(myQuota.updated_date, "MMM d, yyyy h:mm a")}</strong></span>
        </div>
      )}

      {/* Generate Codes */}
      {remaining > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-500" /> Generate Maintenance Codes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Count (max {remaining})</label>
              <input type="number" value={genCount} max={remaining} onChange={e => setGenCount(e.target.value)}
                className="w-full h-12 rounded-xl border border-gray-200 px-4 mt-1 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20" />
            </div>
            <div className="relative">
              <label className="text-sm font-medium text-gray-700">Assign To (optional — locks code to this user)</label>
              {assignUsername && !assignedOpen ? (
                <div className="flex items-center justify-between w-full h-12 rounded-xl border border-gray-200 px-4 mt-1 bg-white">
                  <span className="text-sm font-medium text-gray-900">
                    {approvedMembers.find(m => m.username === assignUsername)?.full_name || ""} <span className="text-gray-400">(@{assignUsername})</span>
                  </span>
                  <button type="button" onClick={() => { setAssignUsername(""); setAssignedSearch(""); setAssignedOpen(true); }} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <input type="text" value={assignedSearch} onChange={e => { setAssignedSearch(e.target.value); setAssignedOpen(true); }}
                  onFocus={() => setAssignedOpen(true)} onBlur={() => setTimeout(() => setAssignedOpen(false), 200)}
                  placeholder={assignUsername ? "Search to change..." : "Search username or name..."}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 mt-1 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20" />
              )}
              {assignedOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg">
                  <button type="button" onClick={() => { setAssignUsername(""); setAssignedSearch(""); setAssignedOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${!assignUsername ? "bg-amber-50 font-medium text-amber-700" : "text-gray-600"}`}>
                    Anyone (no lock)
                  </button>
                  {approvedMembers.filter(m => {
                    if (!assignedSearch) return true;
                    const q = assignedSearch.toLowerCase();
                    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
                  }).slice(0, 50).map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { setAssignUsername(m.username); setAssignedSearch(""); setAssignedOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${assignUsername === m.username ? "bg-amber-50 font-medium text-amber-700" : "text-gray-700"}`}>
                      {m.full_name} <span className="text-gray-400">(@{m.username})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button onClick={generateStoreCodes} disabled={generating} className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" /> {generating ? "Generating..." : `Generate ${parseInt(genCount) || 1} Code(s)`}
          </Button>
        </motion.div>
      ) : (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6 text-center">
          <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">You have used all {quotaAmount} codes in your quota. Contact admin to increase your quota.</p>
        </div>
      )}

      {/* Generated codes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> Your Generated Codes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Code", "Status", "Assigned To", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {myCodes.length === 0 ? <tr><td colSpan="4" className="text-center py-12 text-gray-400">No codes generated yet</td></tr> :
              myCodes.slice(0, 100).map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900">{c.code}</td>
                  <td className="px-6 py-4"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at, "MMM d, yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Managed members */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Managed Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Name", "Username", "Status", "Maintenance", "Joined"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {managedMembers.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">No members assigned to you</td></tr> :
              managedMembers.map(m => {
                const mStatus = maintenanceStatus(m, codes);
                return (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                  <td className="px-6 py-4"><Badge className={m.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{m.status}</Badge></td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${mStatus.isGreen ? "text-green-700" : "text-red-700"}`}>{mStatus.secondsLeft > 0 ? formatTime(mStatus.secondsLeft) : "Expired"}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatDate(m.created_date || m.created_at, "MMM d, yyyy")}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
