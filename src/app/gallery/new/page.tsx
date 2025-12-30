'use client';

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewGalleryPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", imageUrl: "" });
  const [saving, setSaving] = useState(false);

  const createItem = async () => {
    if (!form.title || !form.imageUrl) {
      alert("Title and image are required");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "gallery"), {
        title: form.title,
        imageUrl: form.imageUrl,
        createdAt: serverTimestamp(),
      });
      router.push("/gallery");
    } catch (err) {
      alert("Failed to create gallery item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Gallery</p>
            <h1 className="text-2xl font-black text-slate-900">Add Gallery Item</h1>
            <p className="text-sm text-slate-500">Add media to appear in the mobile gallery tab.</p>
          </div>
          <Link href="/gallery" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow">
            Cancel
          </Link>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <label className="text-sm font-semibold text-slate-700">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Image URL</label>
            <input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt="Preview"
                className="mt-3 h-48 w-full rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="mt-3 flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                Preview unavailable
              </div>
            )}
          </div>
          <button
            onClick={createItem}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create gallery item"}
          </button>
        </div>
      </div>
    </div>
  );
}
