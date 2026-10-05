import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Upload, Trash2 } from "lucide-react";
import { useTable, updateRecord, createRecord } from "../lib/useData";
import { parseAd } from "./AdBanner";
import { Button } from "./ui";

const DRAFT_KEY = "ads_draft";
const PUBLISHED_KEY = "ads_published";

export default function AdminAdsTab() {
  const { data: settings = [], refetch } = useTable("system_settings");
  const [announcement, setAnnouncement] = useState("");
  const [image, setImage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const published = parseAd(settings.find(s => s.setting_key === PUBLISHED_KEY)?.setting_value);

  useEffect(() => {
    if (loaded || settings.length === 0) return;
    const draft = parseAd(settings.find(s => s.setting_key === DRAFT_KEY)?.setting_value) || published;
    if (draft) { setAnnouncement(draft.announcement || ""); setImage(draft.image || ""); }
    setLoaded(true);
  }, [settings]);

  async function save(key, value) {
    const existing = settings.find(s => s.setting_key === key);
    if (existing) await updateRecord("system_settings", existing.id, { setting_value: value });
    else await createRecord("system_settings", { setting_key: key, setting_value: value });
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function run(fn, msg) {
    setBusy(true);
    try { await fn(); await refetch(); toast.success(msg); }
    catch (err) { toast.error(err?.message || "Failed"); }
    setBusy(false);
  }

  const json = () => JSON.stringify({ announcement, image });

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
        <label className="block text-sm font-medium text-gray-700 mb-1">Promote image</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium cursor-pointer hover:bg-purple-700">
            <Upload className="w-4 h-4" /> Upload Image
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          {image && (
            <button onClick={() => setImage("")} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
        </div>
        {image && <img src={image} alt="Preview" className="mt-3 w-full max-h-72 object-cover rounded-2xl border" />}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => run(() => save(DRAFT_KEY, json()), "Draft saved")}
          className="bg-gray-100 text-gray-800 hover:bg-gray-200">Save Draft</Button>
        <Button disabled={busy || (!announcement && !image)}
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
