'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Category = {
  id: string;
  name: string;
  segment: string;
  count: number;
  description?: string;
  imageUrl?: string;
};

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "categories", id));
        if (!mounted) return;
        if (!snap.exists()) {
          setError("Category not found.");
          return;
        }
        const d = snap.data() as any;
        setCategory({
          id,
          name: d.name ?? "Category",
          segment: d.segment ?? "General",
          count: Number(d.count ?? d.total ?? 0),
          description: d.description ?? "",
          imageUrl: d.imageUrl,
        });
      } catch (err) {
        console.warn(err);
        setError("Failed to load category.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Category</p>
            <h1 className="text-2xl font-black text-slate-900">{category?.name || id}</h1>
            <p className="text-sm text-slate-500">Overview of this category and linked items.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/categories"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
            >
              Back to categories
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : loading ? (
            <p className="text-sm text-slate-500">Loading category...</p>
          ) : !category ? (
            <p className="text-sm text-slate-500">No data available.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4">
                {category.imageUrl ? (
                  <div className="h-28 w-28 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                    No image
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {category.segment}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {category.count} active
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 max-w-xl">
                    {category.description || "No description provided for this category."}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DetailRow label="ID" value={category.id} />
                  <DetailRow label="Name" value={category.name} />
                  <DetailRow label="Segment" value={category.segment} />
                  <DetailRow label="Active items" value={category.count.toString()} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
