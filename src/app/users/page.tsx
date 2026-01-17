'use client';

import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  uid?: string | null;
  blocked?: boolean;
  isDriver?: boolean;
  isDriverActive?: boolean;
};

export default function UsersPage() {
  const router = useRouter();
  const [role, setRole] = useState<"superadmin" | "staff" | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRole = (localStorage.getItem("sachio_admin_role") as "superadmin" | "staff" | null) || null;
    if (!storedRole) {
      router.replace("/login");
      return;
    }
    setRole(storedRole);
  }, [router]);

  useEffect(() => {
    if (!role) return;
    let mounted = true;
    async function loadUsers() {
      setError(null);
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
        if (!mounted) return;
        const rows: UserRow[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "unknown",
            name: data.name ?? data.fullName ?? null,
            phone: data.phone ?? data.phoneNumber ?? null,
            blocked: Boolean(data.blocked),
            isDriver: Boolean(data.isDriver),
            isDriverActive: Boolean(data.isDriverActive),
          };
        });
        setUsers(rows);
      } catch (err: any) {
        console.warn("Failed to load users", err);
        if (mounted) setError("Could not load users right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUsers();
    return () => {
      mounted = false;
    };
  }, [role]);

  const handleBlock = async (user: UserRow) => {
    if (role !== "superadmin") return;
    setBlocking((prev) => ({ ...prev, [user.id]: true }));
    try {
      const newStatus = !user.blocked;
      await setDoc(doc(db, "users", user.id), { blocked: newStatus }, { merge: true });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, blocked: newStatus } : u)));
    } catch (err) {
      console.warn("Failed to update user block status", err);
      setError("Could not update user right now.");
    } finally {
      setBlocking((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleDriverToggle = async (user: UserRow) => {
    if (role !== "superadmin") return;
    setBlocking((prev) => ({ ...prev, [user.id]: true }));
    try {
      const nextDriver = !user.isDriver;
      await setDoc(doc(db, "users", user.id), { isDriver: nextDriver }, { merge: true });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isDriver: nextDriver } : u)));
    } catch (err) {
      console.warn("Failed to update driver status", err);
      setError("Could not update driver status right now.");
    } finally {
      setBlocking((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const handleDriverActiveToggle = async (user: UserRow) => {
    if (role !== "superadmin") return;
    if (!user.isDriver) return;
    setBlocking((prev) => ({ ...prev, [user.id]: true }));
    try {
      const nextActive = !user.isDriverActive;
      await setDoc(doc(db, "users", user.id), { isDriverActive: nextActive }, { merge: true });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isDriverActive: nextActive } : u)));
    } catch (err) {
      console.warn("Failed to update driver active status", err);
      setError("Could not update driver status right now.");
    } finally {
      setBlocking((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Directory</p>
            <h1 className="text-2xl font-black text-slate-900">Users</h1>
            <p className="text-sm text-slate-500">View all users with email, uid, name, and phone.</p>
          </div>
          <button
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
            onClick={() => router.push("/")}
          >
            Back to dashboard
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">User list</h2>
            <span className="text-xs font-semibold text-slate-500">{users.length} total</span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Status</th>
                  {role === "superadmin" ? <th className="px-4 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={role === "superadmin" ? 7 : 6} className="px-4 py-4 text-center text-sm text-slate-600">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={role === "superadmin" ? 7 : 6} className="px-4 py-4 text-center text-sm text-slate-600">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                                        <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{user.uid || user.id}</td>
                      <td className="px-4 py-3 text-slate-700">{user.email}</td>
                      <td className="px-4 py-3 text-slate-700">{user.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{user.phone || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
  <span
    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
      user.isDriver
        ? user.isDriverActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600"
    }`}
  >
    {user.isDriver ? (user.isDriverActive ? "Active" : "Inactive") : "No"}
  </span>
</td>
                      <td className="px-4 py-3 text-slate-700">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            user.blocked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {user.blocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      {role === "superadmin" ? (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 disabled:opacity-60 ${
                                user.isDriver
                                  ? "bg-white text-indigo-700 ring-indigo-200 hover:bg-indigo-50"
                                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                              }`}
                              disabled={blocking[user.id]}
                              onClick={() => handleDriverToggle(user)}
                            >
                              {blocking[user.id] ? "Updating..." : user.isDriver ? "Remove driver" : "Make driver"}
                            </button>
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 disabled:opacity-60 ${
                                user.isDriverActive
                                  ? "bg-white text-amber-700 ring-amber-200 hover:bg-amber-50"
                                  : "bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
                              }`}
                              disabled={blocking[user.id] || !user.isDriver}
                              onClick={() => handleDriverActiveToggle(user)}
                            >
                              {blocking[user.id]
                                ? "Updating..."
                                : user.isDriverActive
                                ? "Set inactive"
                                : "Set active"}
                            </button>
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 disabled:opacity-60 ${
                                user.blocked
                                  ? "bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
                                  : "bg-white text-red-700 ring-red-200 hover:bg-red-50"
                              }`}
                              disabled={blocking[user.id]}
                              onClick={() => handleBlock(user)}
                            >
                              {blocking[user.id]
                                ? "Updating..."
                                : user.blocked
                                ? "Unblock"
                                : "Block"}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
