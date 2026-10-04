import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ArrowRight, Ticket, Store as StoreIcon, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { formatDate, money, generateReferralCode, maintenanceStatus, formatTime } from "../lib/helpers";
import { Button, Badge, Input, Label } from "./ui";

export default function SubAdmin() {
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: storeQuotas = [] } = useTable("store_code_quotas");
  const { currentMember } = useCurrentMember(members);

  const [genCount, setGenCount] = useState("1");
  const [genUsername, setGenUsername] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Store Panel</h1>
          <p className="text-gray-600 mb-6">Please login to access the store panel.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  // Quota calculation
  const myQuotas = storeQuotas.filter(q => q.store_member_id === currentMember.id);
  const totalQuota = myQuotas.reduce((s, q) => s + (q.quota_amount || 0), 0);
  const myCodes = codes.filter(c => c.assigned_sub_admin_id === currentMember.id);
  const generatedCount = myCodes.length;
  const remainingQuota = Math.max(0, totalQuota - generatedCount);

  // Members managed by this store
  const managedMembers = members.filter(m => m.referrer_id === currentMember.id);
  const approvedMembers = members.filter(m => m.status === "approved");

  async function generateStoreCodes() {
    const count = parseInt(genCount) || 0;
    if (count < 1) { toast.error("Enter at least 1 code"); return; }
    if (count > remainingQuota) { toast.error(`Only ${remainingQuota} codes remaining in your quota`); return; }
    setGenerating(true);
    try {
      const records = [];
      for (let i = 0; i < count; i++) {
        const base = "MAINT-" + generateReferralCode();
        const code = genUsername ? `${base}-@${genUsername.toUpperCase()}` : base;
        records.push({
          code,
          is_used: false,
          assigned_username: genUsername || null,
          assigned_sub_admin_id: currentMember.id,
        });
      }
      await supabase.from("maintenance_codes").insert(records);
      toast.success(`${count} code(s) generated!`);
      setGenCount("1");
      setGenUsername("");
      setAssignedSearch("");
      refetchCodes();
      window.location.reload();
    } catch { toast.error("Failed to generate codes"); }
    setGenerating(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
            <StoreIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Store Panel</h1>
            <p className="text-gray-500">Generate maintenance codes within your admin-set quota</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Quota", value: totalQuota, color: "from-amber-500 to-orange-600" },
          { label: "Codes Generated", value: generatedCount, color: "from-blue-500 to-indigo-600" },
          { label: "Remaining Quota", value: remainingQuota, color: "from-teal-500 to-emerald-600" },
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

      {/* Generate Codes */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-500" /> Generate Maintenance Codes</h2>
        {remainingQuota === 0 ? (
          <div className="text-center py-8">
            <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No remaining quota. Ask the admin to add more codes to your quota.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Number of Codes (max {remainingQuota})</Label>
                <Input type="number" value={genCount} onChange={e => setGenCount(e.target.value)} max={remainingQuota} placeholder="e.g. 5" />
              </div>
              <div className="relative">
                <Label>Designate To (optional — locks code to this user)</Label>
                {genUsername && !assignedOpen ? (
                  <div className="flex items-center justify-between w-full h-12 rounded-xl border border-gray-200 px-4 bg-white">
                    <span className="text-sm font-medium text-gray-900">
                      {approvedMembers.find(m => m.username === genUsername)?.full_name || ""} <span className="text-gray-400">(@{genUsername})</span>
                    </span>
                    <button type="button" onClick={() => { setGenUsername(""); setAssignedSearch(""); setAssignedOpen(true); }} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={assignedSearch}
                    onChange={e => { setAssignedSearch(e.target.value); setAssignedOpen(true); }}
                    onFocus={() => setAssignedOpen(true)}
                    onBlur={() => setTimeout(() => setAssignedOpen(false), 200)}
                    placeholder="Search username or name..."
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                )}
                {assignedOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg">
                    <button type="button" onClick={() => { setGenUsername(""); setAssignedSearch(""); setAssignedOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${!genUsername ? "bg-amber-50 font-medium text-amber-700" : "text-gray-600"}`}>
                      Anyone (no designation)
                    </button>
                    {approvedMembers
                      .filter(m => {
                        if (!assignedSearch) return true;
                        const q = assignedSearch.toLowerCase();
                        return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
                      })
                      .slice(0, 50)
                      .map(m => (
                        <button key={m.id} type="button"
                          onClick={() => { setGenUsername(m.username); setAssignedSearch(""); setAssignedOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${genUsername === m.username ? "bg-amber-50 font-medium text-amber-700" : "text-gray-700"}`}>
                          {m.full_name} <span className="text-gray-400">(@{m.username})</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={generateStoreCodes} disabled={generating}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> {generating ? "Generating..." : "Generate Codes"}
            </Button>
          </div>
        )}
      </div>

      {/* Quota History */}
      {myQuotas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-teal-500" /> Quota History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Codes Added", "Set By", "Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {myQuotas.map(q => {
                  const admin = members.find(m => m.id === q.set_by_admin_id);
                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">+{q.quota_amount}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{admin?.username || "admin"}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{formatDate(q.created_date, "MMM d, yyyy")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Generated codes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ticket className="w-5 h-5 text-amber-500" /> Generated Maintenance Codes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Code", "Status", "Designated To", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {myCodes.length === 0 ? <tr><td colSpan="4" className="text-center py-12 text-gray-400">No codes generated yet</td></tr> :
              myCodes.slice(0, 50).map(c => (
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
              {["Name", "Username", "Status", "Maintenance", "Referral Code", "Joined"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {managedMembers.length === 0 ? <tr><td colSpan="6" className="text-center py-12 text-gray-400">No members assigned to you</td></tr> :
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
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{m.referral_code || "—"}</td>
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
