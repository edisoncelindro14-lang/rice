import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Upload, Trash2 } from "lucide-react";
import { useTable, updateRecord, createRecord } from "../lib/useData";
import { parseAd, adImages } from "./AdBanner";
import { Button } from "./ui";

const DRAFT_KEY = "ads_draft";
const PUBLISHED_KEY = "ads_published";

export default function AdminAdsTab() {
  const { data: settings = [], refetch } = useTable("system_settings");
  const [announcement, setAnnouncement] = useState("");
  const [images, setImages] = useState([]); // [{src,x,y}]
  const [sel, setSel] = useState(0);
  const drag = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const published = parseAd(settings.find(s => s.setting_key === PUBLISHED_KEY)?.setting_value);

  useEffect(() => {
    if (loaded || settings.length === 0) return;
    const draft = parseAd(settings.find(s => s.setting_key === DRAFT_KEY)?.setting_value) || published;
    if (draft) { setAnnouncement(draft.announcement || ""); setImages(adImages(draft)); }
    setLoaded(true);
  }, [settings]);

  async function save(key, value) {
    const existing = settings.find(s => s.setting_key === key);
    if (existing) await updateRecord("system_settings", existing.id, { setting_value: value });
    else await createRecord("system_settings", { setting_key: key, setting_value: value });
  }

  async function onFile(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const added = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); continue; }
      if (file.size > 2 * 1024 * 1024) { toast.error(`${file.name} is over 2MB`); continue; }
      const src = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
      added.push({ src, x: 50, y: 50 });
    }
    if (added.length) { setSel(images.length); setImages(prev => [...prev, ...added]); }
  }

  const cur = images[sel];
  const setPos = p => setImages(prev => prev.map((im, i) => (i === sel ? { ...im, ...p } : im)));
  function removeCur() {
    setImages(prev => prev.filter((_, i) => i !== sel));
    setSel(0);
  }

  async function run(fn, msg) {
    setBusy(true);
    try { await fn(); await refetch(); toast.success(msg); }
    catch (err) { toast.error(err?.message || "Failed"); }
    setBusy(false);
  }

  const json = () => JSON.stringify({ announcement, images });

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Ads</h2>
        <p className="text-sm text-gray-500">Edit the announcement and promo image. Publishing shows it to all users on top of their dashboard.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Announcement</label>
        <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={4}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          placeholder="Write your announcement..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Promote images</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium cursor-pointer hover:bg-purple-700">
            <Upload className="w-4 h-4" /> Upload Images
            <input type="file" accept="image/*" multiple className="hidden" onChange={onFile} />
          </label>
          {cur && (
            <button onClick={removeCur} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
        </div>
        {cur && (
          <>
            <div className="mt-3 w-full aspect-[16/9] overflow-hidden rounded-2xl border cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: cur.x, y: cur.y }; }}
              onPointerUp={() => { drag.current = null; }}
              onPointerMove={e => {
                const d = drag.current; if (!d) return;
                const r = e.currentTarget.getBoundingClientRect();
                const clamp = v => Math.max(0, Math.min(100, v));
                setPos({ x: clamp(d.x - ((e.clientX - d.px) / r.width) * 100), y: clamp(d.y - ((e.clientY - d.py) / r.height) * 100) });
              }}>
              <img src={cur.src} alt="Preview" draggable={false} className="w-full h-full object-cover pointer-events-none"
                style={{ objectPosition: `${cur.x}% ${cur.y}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Drag the image to adjust what is displayed. Images play as an automatic slideshow.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((im, i) => (
                <img key={i} src={im.src} alt="" onClick={() => setSel(i)}
                  className={`w-20 h-12 object-cover rounded-lg cursor-pointer border-2 ${i === sel ? "border-purple-600" : "border-transparent opacity-70"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => run(() => save(DRAFT_KEY, json()), "Draft saved")}
          className="bg-gray-100 text-gray-800 hover:bg-gray-200">Save Draft</Button>
        <Button disabled={busy || (!announcement && images.length === 0)}
          onClick={() => run(async () => { await save(DRAFT_KEY, json()); await save(PUBLISHED_KEY, json()); }, "Ad published to all users")}
          className="bg-green-600 hover:bg-green-700 text-white">Publish</Button>
        {published && (
          <Button disabled={busy} onClick={() => run(() => save(PUBLISHED_KEY, ""), "Ad unpublished")}
            className="bg-red-50 text-red-700 hover:bg-red-100">Unpublish</Button>
        )}
      </div>
      <p className="text-xs text-gray-500">Status: {published ? "Published" : "Not published"}</p>
    </div>
  );
}
