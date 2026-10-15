import React, { memo, useEffect, useMemo, useState } from "react";
import { Heart, UserPlus } from "lucide-react";
import { maintenanceStatus, formatTime } from "../../lib/helpers";
import { buildVisibleTree, MAX_VISIBLE_NODES } from "./treeData";

const EMPTY_CODES = [];

function TreeNode({ node, childrenByParent, codesByMember, canPlaceMembers, onSelect, onPlace, maxDepth }) {
  const { member, level, children, hiddenCount } = node;
  const downlineCount = childrenByParent.get(member.id)?.length || 0;
  const status = maintenanceStatus(member, codesByMember.get(member.id) || EMPTY_CODES);
  const isRoot = level === 0;
  const isActive = status.isGreen;

  return (
    <div className="flex flex-col items-center">
      <div
        data-node
        data-member-id={member.id}
        onClick={() => onSelect(member)}
        className={`group cursor-pointer relative w-48 rounded-2xl px-3.5 py-3.5 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 ${isActive ? "bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300/50 text-white" : "bg-gradient-to-br from-gray-700 to-black border-gray-700/50 text-white"} ${isRoot ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-gray-50" : ""}`}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-white/10 pointer-events-none" />
        <div className="relative flex items-center gap-2 mb-2.5">
          <span className={`font-bold flex-1 min-w-0 text-center px-1 drop-shadow-sm break-words leading-tight ${(member.username || member.full_name || "").length > 22 ? "text-[10px]" : (member.username || member.full_name || "").length > 16 ? "text-[11px]" : (member.username || member.full_name || "").length > 12 ? "text-xs" : "text-sm"}`}>{member.username || member.full_name}</span>
          <div className="min-w-8 h-8 px-1.5 rounded-lg bg-white/40 flex items-center justify-center flex-shrink-0 ring-2 ring-white/50 shadow-md">
            <span className="text-xs font-extrabold text-white drop-shadow-md tracking-wide">{isRoot ? "You" : `L${level}`}</span>
          </div>
        </div>
        <div className="relative flex items-center justify-between text-[11px] mb-1.5">
          <span className={`flex items-center gap-1 font-medium rounded-full px-1.5 py-0.5 ${isActive ? "bg-white/15" : "bg-white/10"}`}>
            <Heart className={`w-3 h-3 ${isActive ? "text-white fill-white" : "text-white/60"}`} />
            {isActive || status.secondsLeft > 0 ? formatTime(status.secondsLeft) : "Expired"}
          </span>
          <span className="font-bold bg-white/20 rounded-full px-1.5 py-0.5">{downlineCount}/8</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isActive ? "bg-white/80" : "bg-white/50"}`} style={{ width: `${downlineCount / 8 * 100}%` }} />
        </div>
        {canPlaceMembers && downlineCount < 8 && (
          <button onClick={e => { e.stopPropagation(); onPlace(member); }} className="relative mt-2 w-full bg-white/25 hover:bg-white/40 rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-all border border-white/30 hover:border-white/50">
            <UserPlus className="w-3 h-3" /> Place Here
          </button>
        )}
      </div>
      {children.length > 0 && (
        <>
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-blue-500" />
          <div className="flex flex-nowrap justify-center gap-4">
            {children.map((child, index) => (
              <div key={child.member.id} className="relative flex flex-col items-center">
                {children.length > 1 && <div className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ left: index === 0 ? "50%" : "-8px", right: index === children.length - 1 ? "50%" : "-8px" }} />}
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-emerald-400" />
                <TreeNode node={child} childrenByParent={childrenByParent} codesByMember={codesByMember} canPlaceMembers={canPlaceMembers} onSelect={onSelect} onPlace={onPlace} maxDepth={maxDepth} />
              </div>
            ))}
          </div>
        </>
      )}
      {hiddenCount > 0 && (level >= maxDepth ? (
        <div className="mt-2 text-xs text-gray-400 italic">{downlineCount} more downline{downlineCount !== 1 ? "s" : ""} (visible to admins only)</div>
      ) : (
        <button onClick={() => onSelect(member)} className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          View downlines of {member.username || member.full_name}
        </button>
      ))}
    </div>
  );
}

function Tree({ member, childrenByParent, codesByMember, canPlaceMembers, onSelect, onPlace, maxDepth, paused }) {
  const [, setTick] = useState(0);
  const root = useMemo(() => buildVisibleTree(member, childrenByParent, maxDepth), [member, childrenByParent, maxDepth]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [paused]);

  if (!root) return null;
  return (
    <div data-testid="genealogy-tree">
      <p className="mb-4 text-center text-xs text-gray-500">Showing up to {MAX_VISIBLE_NODES} members at a time. Select a member to explore deeper.</p>
      <TreeNode node={root} childrenByParent={childrenByParent} codesByMember={codesByMember} canPlaceMembers={canPlaceMembers} onSelect={onSelect} onPlace={onPlace} maxDepth={maxDepth} />
    </div>
  );
}

export default memo(Tree);
