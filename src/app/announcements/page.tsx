'use client';

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Announcement = {
  id: string;
  title: string;
  message: string;
  createdAt?: Date | null;
  audience?: "all" | "user";
  targetUserId?: string | null;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", audience: "all", targetUserId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; label: string; email?: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const usersSnap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
        if (mounted) {
          setUsers(
            usersSnap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                label: data.email || data.phone || data.name || d.id,
                email: data.email,
              };
            })
          );
        }
        const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
        if (!mounted) return;
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title ?? "Announcement",
            message: data.message ?? "",
            audience: data.audience ?? "all",
            targetUserId: data.targetUserId ?? null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          } as Announcement;
        });
        setAnnouncements(list);
      } catch (e) {
        if (mounted) setError("Could not load announcements.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const addAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (form.audience === "user" && !form.targetUserId.trim()) {
      setError("User ID is required for targeted announcements.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience === "user" ? "user" : "all",
        targetUserId: form.audience === "user" ? form.targetUserId.trim() : null,
        createdAt: serverTimestamp(),
      });
      if (form.audience === "user") {
        const target = users.find((u) => u.id === form.targetUserId);
        if (target?.email) {
          await addDoc(collection(db, "mailQueue"), {
            to: target.email,
            subject: `Announcement: ${form.title.trim()}`,
            text: form.message.trim(),
            createdAt: serverTimestamp(),
          });
        }
      }
      setForm({ title: "", message: "", audience: "all", targetUserId: "" });
      const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title ?? "Announcement",
          message: data.message ?? "",
          audience: data.audience ?? "all",
          targetUserId: data.targetUserId ?? null,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        } as Announcement;
      });
      setAnnouncements(list);
    } catch (err) {
      setError("Could not add announcement.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const confirm = window.confirm("Delete this announcement?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert("Could not delete. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Announcements</p>
            <h1 className="text-2xl font-black text-slate-900">Manage Announcements</h1>
            <p className="text-sm text-slate-500">Create and remove announcements visible across web and mobile.</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={addAnnouncement} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Maintenance downtime"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Audience</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none bg-white"
                  value={form.audience}
            onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as "all" | "user" }))}
          >
            <option value="all">All users</option>
            <option value="user">Specific user</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">User ID (optional)</label>
          {form.audience === "user" ? (
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none bg-white"
              value={form.targetUserId}
              onChange={(e) => setForm((prev) => ({ ...prev, targetUserId: e.target.value }))}
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none bg-slate-50 text-slate-500"
              value="All users"
              readOnly
            />
          )}
        </div>
      </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Message</label>
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="We will be performing maintenance..."
              />
            </div>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Posting..." : "Add announcement"}
            </button>
          </form>

          <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">All announcements</h2>
              {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Fetching announcements…</p>
            ) : announcements.length === 0 ? (
              <p className="text-sm text-slate-500">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Announcement</p>
                        <p className="text-base font-bold text-slate-900">{a.title}</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {a.audience === "user" ? `User: ${a.targetUserId || "N/A"}` : "All users"}
                        </p>
                        {a.createdAt ? (
                          <p className="text-[11px] font-semibold text-slate-500">{a.createdAt.toLocaleString()}</p>
                        ) : null}
                      </div>
                      <button
                        className="text-xs font-semibold text-red-600 hover:underline"
                        onClick={() => deleteAnnouncement(a.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
