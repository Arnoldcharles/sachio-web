'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", price: "", category: "", inStock: true, description: "", imageUrl: "" });

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          setProduct(data);
          setForm({
            title: data.title || "",
            price: data.price ? String(data.price) : "",
            category: data.category || "",
            inStock: data.inStock !== false,
            description: data.description || "",
            imageUrl: data.imageUrl || "",
          });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const updateProduct = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "products", id), {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        inStock: form.inStock,
        description: form.description,
        imageUrl: form.imageUrl,
      });
      router.refresh();
    } catch (err) {
      alert("Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">Loading product…</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">Product not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Product</p>
            <h1 className="text-2xl font-black text-slate-900">{form.title || "Untitled"}</h1>
            <p className="text-sm text-slate-500">Edit product information.</p>
          </div>
          <Link href="/products" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow">
            Back to products
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
            <label className="text-sm font-semibold text-slate-700">Price (₦)</label>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="stock"
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="stock" className="text-sm font-semibold text-slate-700">
              In stock
            </label>
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
                alt="Product preview"
                className="mt-3 h-48 w-full rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="mt-3 flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                Preview unavailable
              </div>
            )}
          </div>
          <button
            onClick={updateProduct}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
