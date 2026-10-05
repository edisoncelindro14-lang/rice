import React, { useEffect, useState } from "react";
import { useTable } from "../lib/useData";

// Shows the published ad (system_settings.ads_published, JSON) to all users.
export function parseAd(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

// Supports the new {images:[{src,x,y}]} format and the old single {image,x,y} one.
export function adImages(ad) {
  if (!ad) return [];
  if (Array.isArray(ad.images)) return ad.images;
  return ad.image ? [{ src: ad.image, x: ad.x ?? 50, y: ad.y ?? 50 }] : [];
}

export default function AdBanner() {
  const { data: settings = [], refetch } = useTable("system_settings");
  useEffect(() => {
    const i = setInterval(refetch, 5000);
    return () => clearInterval(i);
  }, [refetch]);

  const ad = parseAd(settings.find(s => s.setting_key === "ads_published")?.setting_value);
  const images = adImages(ad);
  const count = images.length;
  const [idx, setIdx] = useState(0);
  const active = idx % Math.max(count, 1);
  const next = () => setIdx(i => (i + 1) % count);
  const isVideo = images[active]?.type === "video";
  // Images advance on a timer; videos advance when they finish.
  useEffect(() => {
    if (count < 2 || isVideo) return;
    const t = setTimeout(next, 4000);
    return () => clearTimeout(t);
  }, [count, active, isVideo]);
  if (!ad || (!ad.announcement && count === 0)) return null;

  return (
    <div className="mb-6 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      {count > 0 && (
        <div className="relative w-full aspect-[16/9] bg-gray-100">
          {images.map((im, i) => im.type === "video" ? (
            i === active && <video key={i} src={im.src} autoPlay muted playsInline controls loop={count < 2} onEnded={next} onError={next}
              className="absolute inset-0 w-full h-full object-contain bg-black" />
          ) : (
            <img key={i} src={im.src} alt="Promotion" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === active ? "opacity-100" : "opacity-0"}`}
              style={{ objectPosition: `${im.x ?? 50}% ${im.y ?? 50}%` }} />
          ))}
          {count > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full ${i === active ? "bg-white" : "bg-white/50"}`} />)}
            </div>
          )}
        </div>
      )}
      {ad.announcement && <p className="p-4 text-gray-800 font-medium whitespace-pre-wrap">{ad.announcement}</p>}
    </div>
  );
}
