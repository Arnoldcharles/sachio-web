'use client';

import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";

const ADMIN_UID = "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2";
const ADMIN_EMAIL = "arnoldcharles028@gmail.com";

export default function NewStaffPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const uid = localStorage.getItem("sachio_admin_uid");
    const mail = localStorage.getItem("sachio_admin_email");
    const role = localStorage.getItem("sachio_admin_role");
    const isSuper =
      role === "superadmin" && uid === ADMIN_UID && mail === ADMIN_EMAIL;
    if (!isSuper) {
      router.replace("/login");
    }
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError("Staff email is required.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "staffAccounts"), {
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        role: "staff",
        createdAt: serverTimestamp(),
        createdBy: ADMIN_UID,
      });
      setSuccess("Staff account created.");
      setEmail("");
      setName("");
    } catch (err: any) {
      setError(err?.message || "Could not create staff account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Staff
            </p>
            <h1 className="text-2xl font-black text-slate-900">Create Staff</h1>
            <p className="text-sm text-slate-500">
              Superadmin can add staff login emails here.
            </p>
          </div>
          <button
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
            onClick={() => router.push("/")}
          >
            Back to dashboard
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          {success ? (
            <p className="text-sm font-semibold text-emerald-700">{success}</p>
          ) : null}

          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">
              Staff email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create staff"}
          </button>
        </form>
      </div>
    </div>
  );
}
