import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, Users } from "lucide-react";
import { maintenanceStatus } from "../../lib/helpers";

const ROW_HEIGHT = 56;
const VIEW_HEIGHT = 168;
const OVERSCAN = 3;
const EMPTY_CODES = [];

function MemberList({ members, codesByMember, selectedId, currentMember, isSuperAdmin, onSelect }) {
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.toLowerCase());
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef(null);
  const [, setTick] = useState(0);

  // Only the small visible window refreshes its status dots, not the whole page.
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const searchIndex = useMemo(() => members.map(member => ({
    member,
    text: [member.full_name, member.username, member.email, member.referral_code].join("\n").toLowerCase(),
  })), [members]);
  const filtered = useMemo(() => query
    ? searchIndex.filter(entry => entry.text.includes(query)).map(entry => entry.member)
    : members, [query, searchIndex, members]);

  // Reset during the user's edit, not in a deferred-query effect: that effect
  // can run after a wheel/touch scroll and unexpectedly jump the list to the top.
  function updateSearch(value) {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    setScrollTop(0);
    setSearch(value);
  }

  const start = Math.max(0, Math.min(Math.floor(scrollTop / ROW_HEIGHT), Math.max(0, filtered.length - 1)) - OVERSCAN);
  const end = Math.min(filtered.length, start + VIEW_HEIGHT / ROW_HEIGHT + OVERSCAN * 2);

  return (
    <div data-testid="genealogy-members" className="w-full lg:w-56 flex-shrink-0 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-fit lg:sticky lg:top-4">
      <div className="p-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-gray-500" /> Members</h3>
      </div>
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            aria-label="Search members"
            value={search}
            onChange={e => updateSearch(e.target.value)}
            placeholder="Search members..."
            className="pl-8 w-full rounded-lg border border-gray-200 h-9 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>
      <div
        ref={viewportRef}
        data-testid="genealogy-member-scroll"
        tabIndex={0}
        aria-label="Member list"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        className="overflow-y-auto scroll-thick"
        style={{ maxHeight: VIEW_HEIGHT, overflowAnchor: "none", touchAction: "pan-y" }}
      >
        <div style={{ height: filtered.length * ROW_HEIGHT, position: "relative" }}>
          {filtered.slice(start, end).map((member, index) => {
            const status = maintenanceStatus(member, codesByMember.get(member.id) || EMPTY_CODES);
            return (
              <button
                key={member.id}
                data-member-id={member.id}
                aria-label={`View genealogy for ${member.username || member.full_name}`}
                aria-pressed={selectedId === member.id}
                onClick={() => { onSelect(member); updateSearch(""); }}
                className={`absolute left-0 w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors flex items-center gap-2 ${selectedId === member.id ? "bg-blue-100" : "hover:bg-gray-50"}`}
                style={{ top: (start + index) * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.isGreen ? "bg-blue-500" : "bg-black"}`} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{member.username || member.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{isSuperAdmin ? `L${member.tree_level || 0}` : (member.id === currentMember?.id ? "You" : `L${(member.tree_level || 0) - (currentMember?.tree_level || 0)}`)} · {member.direct_downlines_count || 0}/8</p>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="text-center py-6 text-sm text-gray-400">No members found.</p>}
      </div>
    </div>
  );
}

export default memo(MemberList);
