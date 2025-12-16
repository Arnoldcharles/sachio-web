'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const ADMIN_UID = "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2";
const ADMIN_EMAIL = "arnoldcharles028@gmail.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEmail = localStorage.getItem("sachio_admin_email");
    const role = localStorage.getItem("sachio_admin_role");
    if (storedEmail && role) {
      router.replace("/");
    }
  }, [router]);

  const handleLogin = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    // Superadmin path
    if (trimmed === ADMIN_EMAIL.toLowerCase()) {
      localStorage.setItem("sachio_admin_uid", ADMIN_UID);
      localStorage.setItem("sachio_admin_email", ADMIN_EMAIL);
      localStorage.setItem("sachio_admin_role", "superadmin");
    } else {
      // Staff path
      localStorage.setItem("sachio_admin_uid", `staff-${trimmed}`);
      localStorage.setItem("sachio_admin_email", trimmed);
      localStorage.setItem("sachio_admin_role", "staff");
      try {
        await setDoc(
          doc(db, "staffSessions", trimmed),
          { email: trimmed, role: "staff", status: "online", lastActive: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.warn("Could not record staff session", err);
      }
    }
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sachio Admin</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-500">Enter the admin email to continue.</p>

        <div className="mt-5 space-y-3">
          <label className="text-sm font-semibold text-slate-700" htmlFor="email">
            Admin email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
          />
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        </div>

        <button
          onClick={handleLogin}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
