import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Upload, Trash2 } from "lucide-react";
import { useTable, updateRecord, createRecord } from "../lib/useData";
import { parseAd, adImages } from "./AdBanner";
import { Button } from "./ui";

const MAX_VIDEO = 500 * 1024 * 1024;
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Chunked unsigned upload to Cloudinary into the "ads" folder. Returns { src, public_id }.
async function uploadMedia(file, resourceType, onProgress) {
  if (!CLOUD || !PRESET) throw new Error("Cloudinary is not configured");
  const url = `https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const CHUNK = 20 * 1024 * 1024;
  let json;
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size);
    const fd = new FormData();
    fd.append("file", file.slice(start, end), file.name);
    fd.append("upload_preset", PRESET);
    fd.append("folder", "ads");
    const res = await fetch(url, {
      method: "POST", body: fd,
      headers: { "X-Unique-Upload-Id": uid, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
    });
    json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
    onProgress?.(Math.round((end / file.size) * 100));
  }
  return { src: json.secure_url, public_id: json.public_id };
}

async function deleteFromCloudinary(im) {
  const res = await fetch("/api/cloudinary-delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: im.public_id, resource_type: im.type }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Could not delete from Cloudinary");
}

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
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    for (const file of files) {
      if (file.type.startsWith("video/")) {
        if (file.size > MAX_VIDEO) { toast.error(`${file.name} is over 500MB`); continue; }
        try {
          const m = await uploadMedia(file, "video", p => setUploading(`${p}%`));
          added.push({ type: "video", ...m });
        } catch (err) { toast.error(`Video upload failed: ${err.message}`); }
        continue;
      }
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image or video`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is over 10MB`); continue; }
      try {
        const m = await uploadMedia(file, "image", p => setUploading(`${p}%`));
        added.push({ type: "image", ...m, x: 50, y: 50 });
      } catch (err) { toast.error(`Image upload failed: ${err.message}`); }
    }
    setUploading(false);
    if (added.length) {
      const all = [...images, ...added];
      setSel(images.length); setImages(all);
      // Save right away so an upload is never lost (and left orphaned in Cloudinary) if the page is closed.
      try { await save(DRAFT_KEY, JSON.stringify({ announcement, images: all })); await refetch(); }
      catch (err) { toast.error(`Uploaded, but could not save draft: ${err?.message || "error"}`); }
    }
  }

  const cur = images[sel];
  const setPos = p => setImages(prev => prev.map((im, i) => (i === sel ? { ...im, ...p } : im)));
  // Deletes the file from Cloudinary and removes it from the saved draft and published ad (Supabase).
  async function removeCur() {
    if (!cur || !window.confirm("Delete this file permanently? It will also be removed from Cloudinary.")) return;
    setBusy(true);
    try {
      // A file already gone from Cloudinary must not block removing it from the ad.
      if (cur.public_id) await deleteFromCloudinary(cur).catch(e => toast.error(`Cloudinary: ${e.message}`));
      const rest = images.filter((_, i) => i !== sel);
      const strip = ad => JSON.stringify({ ...ad, images: adImages(ad).filter(im => im.src !== cur.src), image: undefined, x: undefined, y: undefined });
      setImages(rest); setSel(0);
      await save(DRAFT_KEY, JSON.stringify({ announcement, images: rest }));
      if (published) await save(PUBLISHED_KEY, strip(published));
      await refetch();
      toast.success("Deleted from Cloudinary and your ad");
    } catch (err) { toast.error(err?.message || "Delete failed"); }
    setBusy(false);
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Promote images / videos (video up to 500MB)</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium cursor-pointer hover:bg-purple-700">
            <Upload className="w-4 h-4" /> {uploading ? `Uploading${typeof uploading === "string" ? " " + uploading : "..."}` : "Upload Images / Videos"}
            <input type="file" accept="image/*,video/*" multiple disabled={uploading} className="hidden" onChange={onFile} />
          </label>
          {cur && (
            <button onClick={removeCur} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
        </div>
        {cur && (
          <>
            {cur.type === "video" ? (
              <video key={cur.src} src={cur.src} controls muted className="mt-3 w-full aspect-[16/9] rounded-2xl border bg-black" />
            ) : (
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
            )}
            <p className="text-xs text-gray-500 mt-1">Drag the image to adjust what is displayed. Images and videos play as an automatic slideshow.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((im, i) => (
                (im.type === "video"
                  ? <video key={i} src={im.src} preload="metadata" muted onClick={() => setSel(i)} className={`w-20 h-12 object-cover rounded-lg cursor-pointer border-2 ${i === sel ? "border-purple-600" : "border-transparent opacity-70"}`} />
                  : <img key={i} src={im.src} alt="" onClick={() => setSel(i)}
                  className={`w-20 h-12 object-cover rounded-lg cursor-pointer border-2 ${i === sel ? "border-purple-600" : "border-transparent opacity-70"}`} />)
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => run(() => save(DRAFT_KEY, json()), "Draft saved")}
          className="bg-gray-100 text-gray-800 hover:bg-gray-200">Save Draft</Button>
        <Button disabled={busy || uploading || (!announcement && images.length === 0)}
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
