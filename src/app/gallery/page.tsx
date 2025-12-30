'use client';

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";

type GalleryRow = {
  id: string;
  title: string;
  imageUrl: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "gallery"), orderBy("createdAt", "desc")));
        if (!mounted) return;
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            title: d.title ?? "Untitled",
            imageUrl: d.imageUrl ?? "",
          };
        });
        setItems(list);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Gallery</p>
            <h1 className="text-2xl font-black text-slate-900">Gallery Items</h1>
            <p className="text-sm text-slate-500">Manage featured gallery content for the mobile app.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/gallery/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              Add gallery item
            </Link>
            <Link href="/" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Loading gallery…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No gallery items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                    <td className="px-4 py-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-12 w-16 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (deletingId || !window.confirm("Delete this gallery item?")) return;
                          setDeletingId(item.id);
                          try {
                            await deleteDoc(doc(db, "gallery", item.id));
                            setItems((prev) => prev.filter((p) => p.id !== item.id));
                          } catch (err) {
                            alert("Could not delete item. Please try again.");
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        disabled={deletingId === item.id}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
