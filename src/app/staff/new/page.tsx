'use client';

import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";

const ADMIN_UID = "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2";
const ADMIN_EMAIL = "arnoldcharles028@gmail.com";

type StaffSession = { email: string; role: string; status?: string; lastActive?: Date | null };
type StaffAccount = { id: string; email: string; name?: string | null; blocked?: boolean };

export default function NewStaffPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [staffSessions, setStaffSessions] = useState<StaffSession[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

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

    async function loadStaffSessions() {
      try {
        const snap = await getDocs(query(collection(db, "staffSessions"), orderBy("lastActive", "desc")));
        const sessions: StaffSession[] = snap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            email: d.email ?? docSnap.id,
            role: d.role ?? "staff",
            status: d.status ?? "online",
            lastActive: d.lastActive?.toDate ? d.lastActive.toDate() : null,
          };
        });
        setStaffSessions(sessions);
      } catch (err) {
        console.warn("Staff sessions fetch failed", err);
      }
    }
    async function loadStaffAccounts() {
      try {
        const snap = await getDocs(query(collection(db, "staffAccounts"), orderBy("createdAt", "desc")));
        const accounts: StaffAccount[] = snap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            email: d.email ?? "",
            name: d.name ?? null,
            blocked: d.blocked ?? false,
          };
        });
        setStaffAccounts(accounts);
      } catch (err) {
        console.warn("Staff accounts fetch failed", err);
      }
    }
    loadStaffSessions();
    loadStaffAccounts();
    const interval = setInterval(() => {
      loadStaffSessions();
      loadStaffAccounts();
    }, 20000);
    return () => clearInterval(interval);
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
      // refresh lists
      const snap = await getDocs(query(collection(db, "staffAccounts"), orderBy("createdAt", "desc")));
      const accounts: StaffAccount[] = snap.docs.map((docSnap) => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          email: d.email ?? "",
          name: d.name ?? null,
          blocked: d.blocked ?? false,
        };
      });
      setStaffAccounts(accounts);
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

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff presence
              </p>
              <h3 className="text-sm font-bold text-slate-900">Currently logged in</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              {staffSessions.filter((s) => s.status !== "offline").length} online
            </span>
          </div>
          {staffSessions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {staffSessions.map((session) => {
                const isOnline = session.status !== "offline";
                const lastSeen =
                  session.lastActive instanceof Date
                    ? session.lastActive.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—";
                const statusLabel = isOnline ? "Online" : `Last active ${lastSeen}`;
                return (
                  <span
                    key={session.email}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      isOnline ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-50 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {session.email}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" : "bg-slate-400"
                      }`}
                    />
                    <span className="text-[10px] font-medium text-slate-500">{statusLabel}</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-slate-500">No staff sessions yet.</p>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff accounts</p>
              <h3 className="text-sm font-bold text-slate-900">Manage access</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">{staffAccounts.length} total</span>
          </div>
          <div className="mt-3 space-y-2">
            {staffAccounts.length === 0 ? (
              <p className="text-sm text-slate-600">No staff accounts yet.</p>
            ) : (
              staffAccounts.map((acct) => (
                <div
                  key={acct.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{acct.email}</p>
                    <p className="text-xs text-slate-500">{acct.name || "No name"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        acct.blocked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {acct.blocked ? "Blocked" : "Active"}
                    </span>
                    <button
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 disabled:opacity-60 ${
                        acct.blocked
                          ? "bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
                          : "bg-white text-red-700 ring-red-200 hover:bg-red-50"
                      }`}
                      disabled={updating[acct.id]}
                      onClick={async () => {
                        setUpdating((prev) => ({ ...prev, [acct.id]: true }));
                        try {
                          await setDoc(doc(db, "staffAccounts", acct.id), { blocked: !acct.blocked }, { merge: true });
                          setStaffAccounts((prev) =>
                            prev.map((s) => (s.id === acct.id ? { ...s, blocked: !acct.blocked } : s))
                          );
                        } catch (err) {
                          console.warn("Failed to update staff account", err);
                          setError("Could not update staff account.");
                        } finally {
                          setUpdating((prev) => ({ ...prev, [acct.id]: false }));
                        }
                      }}
                    >
                      {updating[acct.id] ? "Updating..." : acct.blocked ? "Unblock" : "Block"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
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
