"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import Image from "next/image";

const SUPERADMIN_ACCOUNTS = [
  {
    uid: "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2",
    email: "arnoldcharles028@gmail.com",
    password: "Arnold2005.",
  },
  {
    uid: "GSPPzYGp20aBdNNkOenJjOFOUsy1",
    email: "hello@sachioexpress.com",
    password: "Sachio@4589.",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEmail = localStorage.getItem("sachio_admin_email");
    const role = localStorage.getItem("sachio_admin_role");
    if (storedEmail && role) {
      router.replace("/");
    }
  }, [router]);

  const findStaffAccount = async (mail: string) => {
    const snap = await getDocs(
      query(
        collection(db, "staffAccounts"),
        where("email", "==", mail),
        limit(1),
      ),
    );
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as any;
    }
    return null;
  };

  const handleLogin = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    // Superadmin path
    const superadminAccount = SUPERADMIN_ACCOUNTS.find(
      (account) => account.email.toLowerCase() === trimmed,
    );
    if (superadminAccount) {
      if (password !== superadminAccount.password) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      localStorage.setItem("sachio_admin_uid", superadminAccount.uid);
      localStorage.setItem("sachio_admin_email", superadminAccount.email);
      localStorage.setItem("sachio_admin_role", "superadmin");
    } else {
      // Staff path
      const staffAccount = await findStaffAccount(trimmed);
      if (!staffAccount) {
        setError("You are not authorized as staff.");
        setLoading(false);
        return;
      }
      if (staffAccount.blocked) {
        setError("This staff account is blocked. Contact your administrator.");
        setLoading(false);
        return;
      }
      localStorage.setItem("sachio_admin_uid", `staff-${trimmed}`);
      localStorage.setItem("sachio_admin_email", trimmed);
      localStorage.setItem("sachio_admin_role", "staff");
      try {
        await setDoc(
          doc(db, "staffSessions", trimmed),
          {
            email: trimmed,
            role: "staff",
            status: "online",
            lastActive: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.warn("Could not record staff session", err);
      }
    }
    router.replace("/");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Image
            src="/logo (1).png"
            alt="Sachio logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Sachio Mobile Toilets
            </p>
            <h1 className="text-2xl font-black text-slate-900">Sign in</h1>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Enter your admin email and password to continue.
        </p>

        <div className="mt-5 space-y-3">
          <label
            className="text-sm font-semibold text-slate-700"
            htmlFor="email"
          >
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
          <label
            className="text-sm font-semibold text-slate-700"
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
          />
          {error ? (
            <p className="text-sm font-semibold text-red-600">{error}</p>
          ) : null}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Please wait..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
