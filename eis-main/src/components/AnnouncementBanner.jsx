import React from "react";
import { Megaphone, X } from "lucide-react";
import { useTable } from "../lib/useData";

/**
 * Site-wide announcement banner shown below the maintenance timer.
 * Reads `announcement_text` and `announcement_enabled` from system_settings.
 */
export default function AnnouncementBanner() {
  const { data: settings = [] } = useTable("system_settings");
  const map = {};
  settings.forEach(s => { map[s.setting_key] = s.setting_value; });

  const enabled = map.announcement_enabled === "true";
  const text = map.announcement_text;

  if (!enabled || !text) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2">
      <Megaphone className="w-4 h-4 shrink-0" />
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  );
}
