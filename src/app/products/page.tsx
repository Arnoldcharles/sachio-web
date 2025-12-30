'use client';

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";

type ProductRow = {
  id: string;
  title: string;
  category: string;
  price: number;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
        if (!mounted) return;
        const list = snap.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            title: d.title ?? "Untitled",
            category: d.category ?? "General",
            price: Number(d.price) || 0,
            inStock: d.inStock !== false,
            ratingAvg: Number(d.ratingAvg || 0),
            ratingCount: Number(d.ratingCount || 0),
          };
        });
        setProducts(list);
      } finally {
        setLoading(false);
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
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Products</p>
            <h1 className="text-2xl font-black text-slate-900">All Products</h1>
            <p className="text-sm text-slate-500">Manage inventory, stock levels, and pricing.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/products/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              Add product
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
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No products yet.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{product.title}</td>
                    <td className="px-4 py-3 text-slate-700">{product.category}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">₦{product.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {product.ratingCount
                        ? `${product.ratingAvg.toFixed(1)} (${product.ratingCount})`
                        : "New"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {product.inStock ? "In stock" : "Out"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/products/${product.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                          Edit
                        </Link>
                        <button
                          onClick={async () => {
                            if (deletingId || !window.confirm("Delete this product? This cannot be undone.")) return;
                            setDeletingId(product.id);
                            try {
                              await deleteDoc(doc(db, "products", product.id));
                              setProducts((prev) => prev.filter((p) => p.id !== product.id));
                            } catch (err) {
                              alert("Could not delete product. Please try again.");
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          disabled={deletingId === product.id}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                        >
                          {deletingId === product.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
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
