'use client';

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export default function EditCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    segment: "",
    count: "",
    description: "",
    imageUrl: "",
  });

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
        setForm({
          name: d.name ?? "",
          segment: d.segment ?? "",
          count: String(d.count ?? d.total ?? ""),
          description: d.description ?? "",
          imageUrl: d.imageUrl ?? "",
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!id) return;
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "categories", id), {
        name: form.name.trim(),
        segment: form.segment.trim() || "General",
        count: Number(form.count) || 0,
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim() || null,
      });
      router.push(`/categories/${id}`);
    } catch (err) {
      console.warn(err);
      setError("Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Categories</p>
            <h1 className="text-2xl font-black text-slate-900">Edit Category</h1>
            <p className="text-sm text-slate-500">Update this category's details.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/categories/${id ?? ""}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
            >
              Cancel
            </Link>
            <Link
              href="/categories"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Categories
            </Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-slate-500">Loading category...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  required
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  placeholder="VIP Units"
                />
                <Field
                  label="Segment"
                  value={form.segment}
                  onChange={(value) => setForm((prev) => ({ ...prev, segment: value }))}
                  placeholder="Premium"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Active items"
                  type="number"
                  value={form.count}
                  onChange={(value) => setForm((prev) => ({ ...prev, count: value }))}
                  placeholder="0"
                />
                <Field
                  label="Image URL"
                  value={form.imageUrl}
                  onChange={(value) => setForm((prev) => ({ ...prev, imageUrl: value }))}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none"
                  rows={4}
                  placeholder="Notes about this category..."
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none"
      />
    </div>
  );
}
