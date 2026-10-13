import React, { useEffect } from "react";
import { Megaphone } from "lucide-react";
import { useTable } from "../lib/useData";
import { supabase } from "../lib/supabase";

/**
 * Site-wide announcement banner shown below the maintenance timer.
 * Reads `announcement_text` and `announcement_enabled` from system_settings.
 * Listens to realtime changes so the banner appears immediately after the
 * admin saves it.
 */
export default function AnnouncementBanner() {
  const { data: settings = [], refetch } = useTable("system_settings");

  useEffect(() => {
    const channel = supabase
      .channel("announcement_banner_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => refetch())
      .subscribe();
    const interval = setInterval(() => refetch(), 5000);
    const onSettingsChanged = () => refetch();
    window.addEventListener("system_settings_changed", onSettingsChanged);
    return () => { supabase.removeChannel(channel); clearInterval(interval); window.removeEventListener("system_settings_changed", onSettingsChanged); };
  }, [refetch]);

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
