'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Category = {
  id: string;
  name: string;
  segment: string;
  count: number;
  imageUrl?: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "categories"), orderBy("count", "desc")));
        if (!mounted) return;
        const list = snap.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            name: d.name ?? "Category",
            segment: d.segment ?? "General",
            count: Number(d.count ?? d.total ?? 0),
            imageUrl: d.imageUrl,
          } as Category;
        });
        setCategories(list);
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
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Categories</p>
            <h1 className="text-2xl font-black text-slate-900">All Categories</h1>
            <p className="text-sm text-slate-500">Organize products and rentals into manageable groups.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/categories/new"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Add category
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3 text-right">Active items</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No categories yet.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {category.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{category.name}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{category.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {category.segment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{category.count}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/categories/${category.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                        View
                      </Link>
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
