'use client';

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type CategoryPayload = {
  name: string;
  segment?: string;
  count?: number;
  description?: string;
  imageUrl?: string;
  createdAt?: unknown;
};

export default function NewCategoryPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    segment: "",
    count: "",
    description: "",
    imageUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload: CategoryPayload = {
        name: form.name.trim(),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "categories"), payload);
      router.push("/categories");
    } catch (err) {
      console.warn(err);
      setError("Could not create category.");
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
            <h1 className="text-2xl font-black text-slate-900">Create Category</h1>
            <p className="text-sm text-slate-500">Add a new category for your products or rentals.</p>
          </div>
          <Link
            href="/categories"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
          >
            Back to categories
          </Link>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <Field
            label="Name"
            required
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="VIP Units"
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create category"}
          </button>
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
