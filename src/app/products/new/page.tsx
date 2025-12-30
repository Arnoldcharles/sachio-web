'use client';

import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", price: "", category: "", description: "", imageUrl: "", inStock: true });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadCategories() {
      try {
        const snap = await getDocs(query(collection(db, "categories"), orderBy("name", "asc")));
        if (!mounted) return;
        const list = snap.docs.map((doc) => {
          const d = doc.data() as any;
          return { id: doc.id, name: d.name ?? doc.id };
        });
        setCategories(list);
        if (!form.category && list.length) {
          setForm((prev) => ({ ...prev, category: list[0].name }));
        }
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  const createProduct = async () => {
    if (!form.title || !form.price) {
      alert("Title and price are required");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "products"), {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        imageUrl: form.imageUrl,
        inStock: form.inStock,
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: serverTimestamp(),
      });
      router.push("/products");
    } catch (err) {
      alert("Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Products</p>
            <h1 className="text-2xl font-black text-slate-900">Add New Product</h1>
            <p className="text-sm text-slate-500">Create inventory items for the mobile app.</p>
          </div>
          <Link href="/products" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow">
            Cancel
          </Link>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <label className="text-sm font-semibold text-slate-700">Product title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Price (₦)</label>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Category</label>
            {loadingCategories ? (
              <p className="mt-2 text-xs text-slate-500">Loading categories...</p>
            ) : categories.length ? (
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1 flex flex-col gap-2">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Enter a category"
                />
                <Link href="/categories/new" className="text-xs font-semibold text-emerald-700 hover:underline">
                  Add a category first
                </Link>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={4}
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
          <div className="flex items-center gap-2">
            <input
              id="inStock"
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="inStock" className="text-sm font-semibold text-slate-700">
              In stock
            </label>
          </div>
          <button
            onClick={createProduct}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create product"}
          </button>
        </div>
      </div>
    </div>
  );
}
