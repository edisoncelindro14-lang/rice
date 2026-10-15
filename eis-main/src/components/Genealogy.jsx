import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GitBranch, ArrowRight, Users, ZoomIn, ZoomOut, Activity, UserPlus, X, ChevronLeft } from "lucide-react";
import { useTable, useCurrentMember, updateRecord } from "../lib/useData";
import { Button } from "./ui";
import { distributePlacementCommissions } from "../lib/commissions";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import MemberList from "./genealogy/MemberList";
import Tree from "./genealogy/Tree";
import { indexChildren, indexLatestCodes } from "./genealogy/treeData";

function Genealogy() {
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const panStart = useRef(null);
  const treeRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [placementTarget, setPlacementTarget] = useState(null);
  const [placing, setPlacing] = useState(false);
  const { data: members = [], isLoading, refetch: refetchMembers } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { currentMember } = useCurrentMember(members);

  useEffect(() => {
    if (currentMember && !selected) setSelected(currentMember);
  }, [currentMember]);

  // Keep navigation stable, and snapshot the previous member before queuing history.
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  // Navigate to a member: push current selection onto history stack, reset pan to top.
  const selectMember = useCallback((member) => {
    const previous = selectedRef.current;
    if (previous && previous.id !== member.id) {
      setHistory(h => [...h, previous]);
    }
    selectedRef.current = member;
    setSelected(member);
    setPan({ x: 0, y: 0 });
  }, []);

  // Go back to the previous member in history.
  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    selectedRef.current = previous;
    setSelected(previous);
    setPan({ x: 0, y: 0 });
    setHistory(h => h.slice(0, -1));
  }, [history]);

  const allApproved = useMemo(() => members.filter(m => m.status === "approved"), [members]);
  const lobbyMembers = useMemo(() => members.filter(m => m.status === "pending" && m.referrer_id === currentMember?.id), [members, currentMember?.id]);
  const isSuperAdmin = currentMember?.username === "supadmin" || currentMember?.username === "admin";
  const childrenByParent = useMemo(() => indexChildren(allApproved), [allApproved]);
  const codesByMember = useMemo(() => indexLatestCodes(codes), [codes]);

  // Non-super-admin viewers only see their own downline tree — supadmin, admin,
  // and crosslines (members outside their downline lineage) are hidden.
  const visibleIds = useMemo(() => {
    if (isSuperAdmin || !currentMember) return null;
    const ids = new Set([currentMember.id]);
    const stack = [currentMember.id];
    while (stack.length) {
      const id = stack.pop();
      (childrenByParent.get(id) || []).forEach(m => {
        if (!ids.has(m.id)) { ids.add(m.id); stack.push(m.id); }
      });
    }
    return ids;
  }, [isSuperAdmin, currentMember, childrenByParent]);

  const approvedMembers = useMemo(() => visibleIds
    ? allApproved.filter(m => visibleIds.has(m.id))
    : allApproved, [allApproved, visibleIds]);

  const visibleChildrenByParent = useMemo(() => indexChildren(approvedMembers), [approvedMembers]);
  const maxDepth = isSuperAdmin ? Infinity : 5;

  async function handlePlaceMember(lobbyMember) {
    setPlacing(true);
    try {
      const treeLevel = (placementTarget.tree_level || 0) + 1;
      const { error: placeError } = await updateRecord("members", lobbyMember.id, {
        placement_id: placementTarget.id,
        status: "approved",
        tree_level: treeLevel,
        approved_date: new Date().toISOString(),
      });
      if (placeError) {
        toast.error(placeError.message?.includes("placement_id")
          ? "Placement is not configured in this database. Apply migration 005_genealogy_placement.sql in Supabase, then try again."
          : placeError.message || "Failed to place member");
        setPlacing(false);
        return;
      }
      const { error: countError } = await updateRecord("members", placementTarget.id, {
        direct_downlines_count: (placementTarget.direct_downlines_count || 0) + 1,
      });
      if (countError) console.error("Failed to update downline count:", countError.message);
      // If the member already redeemed a code while in the lobby, distribute commissions now
      const { data: freshMembers } = await supabase.from("members").select("*");
      const { data: freshCodes } = await supabase.from("maintenance_codes").select("*");
      const placedMember = (freshMembers || members).find(m => m.id === lobbyMember.id);
      if (placedMember) {
        const count = await distributePlacementCommissions(placedMember, freshMembers || members, freshCodes || codes);
        if (count > 0) toast.success(`${lobbyMember.username} placed under ${placementTarget.username}. ${count} upline bonus(es) distributed.`);
        else toast.success(`${lobbyMember.username} placed under ${placementTarget.username}`);
      } else {
        toast.success(`${lobbyMember.username} placed under ${placementTarget.username}`);
      }
      setPlacementTarget(null);
      await refetchMembers();
    } catch (err) {
      toast.error(err.message || "Failed to place member");
    }
    setPlacing(false);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading genealogy...</div>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <GitBranch className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">ProductPrime Tree</h1>
          <p className="text-gray-600 mb-6">Please login to view your genealogy.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const handlePointerDown = (e) => {
    // Keep button presses out of canvas panning: capture redirects their click.
    if (e.button !== 0 || e.target.closest("button, a, input, select, textarea, [data-node]")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !treeRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Update the DOM directly — bypassing React re-renders for smooth 60fps panning.
    const nx = panStart.current.x + dx;
    const ny = panStart.current.y + dy;
    treeRef.current.style.transform = `translate3d(${nx}px, ${ny}px, 0) scale(${zoom / 100})`;
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      // Commit final position to React state once, after the drag ends.
      if (treeRef.current) {
        const match = treeRef.current.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
        if (match) setPan({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
      }
    }
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 genealogy-scroll">
      <style>{`
        html::-webkit-scrollbar { width: 40px !important; }
        html::-webkit-scrollbar-track { background: #e5e7eb !important; border-radius: 20px; }
        html::-webkit-scrollbar-thumb { background: #6366f1 !important; border-radius: 20px; border: 4px solid #e5e7eb; }
        html::-webkit-scrollbar-thumb:hover { background: #4f46e5 !important; }
        html { scrollbar-width: thick !important; scrollbar-color: #6366f1 #e5e7eb !important; }
        .scroll-thick::-webkit-scrollbar { width: 40px !important; height: 40px !important; }
        .scroll-thick::-webkit-scrollbar-track { background: #e5e7eb !important; border-radius: 20px; }
        .scroll-thick::-webkit-scrollbar-thumb { background: #6366f1 !important; border-radius: 20px; border: 4px solid #e5e7eb; }
        .scroll-thick::-webkit-scrollbar-thumb:hover { background: #4f46e5 !important; }
        .scroll-thick { scrollbar-width: thick !important; scrollbar-color: #6366f1 #e5e7eb !important; }
      `}</style>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ProductPrime Tree</h1>
            <p className="text-gray-500">{isSuperAdmin ? "Full network — up to 8 downlines per member" : "5-level network — up to 8 downlines per member"}</p>
          </div>
        </div>
      </motion.div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 animate-pulse shadow-sm shadow-blue-500/50" />
          <span className="text-sm font-semibold text-blue-700">Active — Maintenance redeemed</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 shadow-sm">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-black shadow-sm shadow-gray-800/50" />
          <span className="text-sm font-semibold text-gray-800">Inactive — No maintenance</span>
        </div>
      </div>

      {/* Lobby — unplaced members who used the current user's referral link */}
      {lobbyMembers.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4">
          <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4" /> Lobby — {lobbyMembers.length} member{lobbyMembers.length !== 1 ? "s" : ""} waiting for placement
          </h3>
          <p className="text-xs text-amber-700 mb-3">These members registered using your referral link. Click "Place Here" on any node in your tree to position them.</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-thick">
            {lobbyMembers.map(m => (
              <div key={m.id} className="flex-shrink-0 bg-white rounded-xl border border-amber-200 px-3 py-2 flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xs">
                  {(m.username || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{m.username || m.full_name}</p>
                  <p className="text-xs text-gray-400">{new Date(m.created_date || m.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <MemberList
          members={approvedMembers}
          codesByMember={codesByMember}
          selectedId={selected?.id}
          currentMember={currentMember}
          isSuperAdmin={isSuperAdmin}
          onSelect={selectMember}
        />

        {/* Right: Tree visualization */}
        <div className="flex-1 min-w-0 min-h-[700px] flex flex-col bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl shadow-lg border border-gray-200">
          {/* Zoom controls — sticky below the mobile header so they never scroll under it */}
          <div className="sticky top-16 lg:static z-30 bg-white flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 rounded-t-2xl">
            <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4 flex-shrink-0" />
              <span className="min-w-0 break-all">Network tree — <strong className="text-gray-700">{selected?.username || selected?.full_name || "—"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={goBack} className="h-11 px-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center gap-1 text-white shadow-lg hover:scale-105 active:scale-95 transition-all text-sm font-bold">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button onClick={() => setZoom(z => z <= 10 ? Math.max(1, z - 1) : Math.max(1, z - 10))} className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all">
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-gray-700 w-14 text-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all">
                <ZoomIn className="w-5 h-5" />
              </button>

            </div>
          </div>
          <div
            className="relative flex-1 min-h-[620px] overflow-hidden p-4 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div ref={treeRef} className="absolute inset-x-4 top-4" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`, transformOrigin: 'top center', transition: isDragging ? 'none' : 'transform 0.15s ease-out', willChange: isDragging ? 'transform' : 'auto' }}>
              {selected ? (
                <Tree
                  member={selected}
                  childrenByParent={visibleChildrenByParent}
                  codesByMember={codesByMember}
                  canPlaceMembers={lobbyMembers.length > 0}
                  onSelect={selectMember}
                  onPlace={setPlacementTarget}
                  maxDepth={maxDepth}
                  paused={isDragging}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Users className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">No genealogy data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Placement modal */}
      {placementTarget && lobbyMembers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPlacementTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Place under</h3>
                <p className="text-sm text-amber-600 font-medium">@{placementTarget.username || placementTarget.full_name}</p>
              </div>
              <button onClick={() => setPlacementTarget(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select a lobby member to place as their downline:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto scroll-thick">
              {lobbyMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => handlePlaceMember(m)}
                  disabled={placing}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm">
                    {(m.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{m.username || m.full_name}</p>
                    <p className="text-xs text-gray-400">Registered {new Date(m.created_date || m.created_at).toLocaleDateString()}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-amber-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Admin has its own countdown; it must not re-render this independent view.
export default React.memo(Genealogy);
