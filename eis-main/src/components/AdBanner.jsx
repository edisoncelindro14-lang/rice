import React, { useEffect } from "react";
import { useTable } from "../lib/useData";

// Shows the published ad (system_settings.ads_published, JSON) to all users.
export function parseAd(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

export default function AdBanner() {
  const { data: settings = [], refetch } = useTable("system_settings");
  useEffect(() => {
    const i = setInterval(refetch, 5000);
    return () => clearInterval(i);
  }, [refetch]);

  const ad = parseAd(settings.find(s => s.setting_key === "ads_published")?.setting_value);
  if (!ad || (!ad.announcement && !ad.image)) return null;

  return (
    <div className="mb-6 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      {ad.image && <img src={ad.image} alt="Promotion" className="w-full max-h-96 object-cover" />}
      {ad.announcement && <p className="p-4 text-gray-800 font-medium whitespace-pre-wrap">{ad.announcement}</p>}
    </div>
  );
}
