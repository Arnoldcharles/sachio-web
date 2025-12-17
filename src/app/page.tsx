"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Image from "next/image";

type Stat = {
  label: string;
  value: string;
  delta?: string;
  tone?: "green" | "orange" | "red";
};
type Announcement = {
  id: string;
  title: string;
  message: string;
  createdAt?: Date | null;
};
export type OrderStatus =
  | "Processing"
  | "Dispatched"
  | "Delivered"
  | "Cancelled"
  | "Cancelled_by_admin"
  | "In transit"
  | "Completed";
type RawOrder = {
  id: string;
  customer: string;
  type: "Buy" | "Rent";
  amount: number;
  status: OrderStatus;
  eta: string;
  createdAt: Date | null;
};
type Order = {
  id: string;
  customer: string;
  type: "Buy" | "Rent";
  total: string;
  status: OrderStatus;
  eta: string;
};
type Product = {
  id: string;
  title: string;
  price: string;
  category: string;
  inStock: boolean;
};
type Category = {
  id: string;
  name: string;
  segment?: string;
  count?: number;
  imageUrl?: string;
};
type Lane = { label: string; value: number };
type Alert = { title: string; tone: "red" | "amber" | "emerald" };
type TrendPoint = { label: string; value: number };
type DashboardData = {
  stats: Stat[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  lanes: Lane[];
  alerts: Alert[];
  revenueTrend: TrendPoint[];
};
type RevenueTotals = { daily: number; monthly: number; yearly: number };

const trendOptions = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
];

const ADMIN_UID = "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2";
const ADMIN_EMAIL = "arnoldcharles028@gmail.com";

const fallbackData: DashboardData = {
  categories: [
    { id: "cat-vip", name: "VIP Units" },
    { id: "cat-standard", name: "Standard Units" },
    { id: "cat-lux", name: "Luxury Trailers" },
    { id: "cat-longterm", name: "Long-term Rentals" },
  ],
  stats: [
    {
      label: "Revenue (MTD)",
      value: "NGN 8,240,000",
      delta: "+12.4%",
      tone: "green",
    },
    { label: "Orders", value: "182", delta: "+6.1%" },
    {
      label: "Rentals in progress",
      value: "48",
      delta: "-3.2%",
      tone: "orange",
    },
    { label: "On-time delivery", value: "96%", delta: "+1.5%", tone: "green" },
  ],
  orders: [
    {
      id: "ORD-1024",
      customer: "Halima O.",
      type: "Rent",
      total: "NGN 420,000",
      status: "Processing",
      eta: "Today, 4:00PM",
    },
    {
      id: "ORD-1023",
      customer: "Bright Events",
      type: "Buy",
      total: "NGN 1,200,000",
      status: "Dispatched",
      eta: "Today, 6:30PM",
    },
    {
      id: "ORD-1022",
      customer: "MegaBuild",
      type: "Rent",
      total: "NGN 680,000",
      status: "Delivered",
      eta: "Yesterday",
    },
    {
      id: "ORD-1021",
      customer: "Chika I.",
      type: "Rent",
      total: "NGN 220,000",
      status: "Cancelled",
      eta: "-",
    },
  ],
  products: [
    {
      id: "PRD-1001",
      title: "VIP Mobile Toilet",
      price: "₦600,000",
      category: "VIP",
      inStock: true,
    },
    {
      id: "PRD-1002",
      title: "Standard Mobile Toilet",
      price: "₦320,000",
      category: "Standard",
      inStock: true,
    },
    {
      id: "PRD-1003",
      title: "Luxury Restroom Trailer",
      price: "₦1,800,000",
      category: "Luxury",
      inStock: false,
    },
  ],
  lanes: [
    { label: "Fulfillment", value: 82 },
    { label: "Cleanliness QA", value: 91 },
    { label: "Driver Availability", value: 76 },
    { label: "Support SLA", value: 88 },
  ],
  alerts: [
    { title: "2 rentals late for pickup", tone: "red" },
    { title: "Driver availability trending low", tone: "amber" },
    { title: "Inventory threshold reached (VIP units)", tone: "emerald" },
  ],
  revenueTrend: [
    { label: "Day 1", value: 720000 },
    { label: "Day 2", value: 680000 },
    { label: "Day 3", value: 800000 },
    { label: "Day 4", value: 900000 },
    { label: "Day 5", value: 760000 },
    { label: "Day 6", value: 840000 },
    { label: "Day 7", value: 920000 },
  ],
};

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  const [trendDays, setTrendDays] = useState<number>(7);
  const [role, setRole] = useState<"superadmin" | "staff" | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [revenueTotals, setRevenueTotals] = useState<RevenueTotals>({
    daily: 0,
    monthly: 0,
    yearly: 0,
  });
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEmail = localStorage.getItem("sachio_admin_email");
    const storedRole =
      (localStorage.getItem("sachio_admin_role") as
        | "superadmin"
        | "staff"
        | null) || null;
    if (!storedEmail || !storedRole) {
      router.push("/login");
      return;
    }
    setRole(storedRole);
    setEmail(storedEmail);
  }, [router]);

  const touchStaffSession = async (
    status: "online" | "offline",
    emailValue?: string | null,
    roleValue?: string | null
  ) => {
    const resolvedEmail = emailValue ?? email;
    const resolvedRole = roleValue ?? role;
    if (!resolvedEmail || resolvedRole !== "staff") return;
    try {
      await setDoc(
        doc(db, "staffSessions", resolvedEmail),
        {
          email: resolvedEmail,
          role: resolvedRole,
          status,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Staff session update failed", err);
    }
  };

  useEffect(() => {
    if (role !== "staff" || !email) return;
    touchStaffSession("online", email, role);
  }, [role, email]);

  const handleExport = () => {
    if (typeof window === "undefined") return;

    const statRows = data.stats
      .map(
        (s) =>
          `<tr><td>${s.label}</td><td>${s.value}</td><td>${
            s.delta ?? ""
          }</td></tr>`
      )
      .join("");
    const orderRows = data.orders
      .map(
        (o) =>
          `<tr><td>${o.id}</td><td>${o.customer}</td><td>${o.type}</td><td>${o.total}</td><td>${o.status}</td><td>${o.eta}</td></tr>`
      )
      .join("");
    const productRows = data.products
      .map(
        (p) =>
          `<tr><td>${p.title}</td><td>${p.category}</td><td>${
            p.price
          }</td><td>${p.inStock ? "Yes" : "No"}</td></tr>`
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Sachio Dashboard Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            h2 { margin-top: 24px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; }
            th { background: #f8fafc; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Sachio Operations Dashboard</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>

          <h2>Stats</h2>
          <table>
            <thead><tr><th>Metric</th><th>Value</th><th>Delta</th></tr></thead>
            <tbody>${statRows}</tbody>
          </table>

          <h2>Orders</h2>
          <table>
            <thead><tr><th>ID</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th>ETA</th></tr></thead>
            <tbody>${orderRows}</tbody>
          </table>

          <h2>Products</h2>
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Price</th><th>In stock</th></tr></thead>
            <tbody>${productRows}</tbody>
          </table>
        </body>
      </html>
    `;

    // Print-friendly HTML
    const htmlBlob = new Blob([html], { type: "text/html" });
    const htmlUrl = URL.createObjectURL(htmlBlob);

    // Trigger print using a hidden iframe (avoids blank popup issues)
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = htmlUrl;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(htmlUrl);
      }, 500);
    };
    document.body.appendChild(iframe);

    // Build a lightweight PDF for direct download (text-only summary)
    const pdfLines: string[] = [];
    pdfLines.push("Sachio Operations Dashboard");
    pdfLines.push(`Generated: ${new Date().toLocaleString()}`);
    pdfLines.push("");
    pdfLines.push("-- Stats --");
    data.stats.forEach((s) =>
      pdfLines.push(`• ${s.label}: ${s.value}${s.delta ? ` (${s.delta})` : ""}`)
    );
    pdfLines.push("");
    pdfLines.push(`-- Orders (${data.orders.length}) --`);
    data.orders.forEach((o) =>
      pdfLines.push(
        `• ${o.id} | ${o.customer} | ${o.type} | ${o.total} | ${o.status} | ${o.eta}`
      )
    );
    pdfLines.push("");
    pdfLines.push(`-- Products (${data.products.length}) --`);
    data.products.forEach((p) =>
      pdfLines.push(
        `• ${p.title} (${p.category}) ${p.price} ${
          p.inStock ? "[In stock]" : "[Out]"
        }`
      )
    );

    const pdfContent = buildSimplePdf(pdfLines);
    const pdfBlob = new Blob([pdfContent], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const pdfLink = document.createElement("a");
    pdfLink.href = pdfUrl;
    pdfLink.download = "sachio-dashboard-export.pdf";
    pdfLink.style.display = "none";
    document.body.appendChild(pdfLink);
    pdfLink.click();
    pdfLink.remove();
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
  };

  const handleAnnouncement = async () => {
    if (typeof window === "undefined" || announcing) return;
    window.location.href = "/announcements";
  };

  const handleLogout = async () => {
    if (typeof window === "undefined") return;
    const storedEmail = localStorage.getItem("sachio_admin_email");
    const storedRole = localStorage.getItem("sachio_admin_role");
    await touchStaffSession("offline", storedEmail, storedRole);
    localStorage.removeItem("sachio_admin_uid");
    localStorage.removeItem("sachio_admin_email");
    localStorage.removeItem("sachio_admin_role");
    window.location.href = "/login";
  };

  useEffect(() => {
    if (role !== "staff" || !email) return;
    let cancelled = false;
    const checkBlocked = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "staffAccounts"),
            where("email", "==", email),
            limit(1)
          )
        );
        const docSnap = snap.docs[0];
        const data = docSnap?.data() as any;
        if (!cancelled && data?.blocked) {
          alert(
            "Your staff access has been blocked. Please contact an administrator."
          );
          handleLogout();
        }
      } catch (err) {
        // ignore fetch errors to avoid blocking dashboard
      }
    };
    checkBlocked();
    const interval = setInterval(checkBlocked, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [role, email]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const statsSnap = await getDocs(collection(db, "dashboardStats"));
        const stats = statsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            label: d.label ?? "Metric",
            value: d.value ?? "0",
            delta: d.delta ?? "",
            tone: d.tone ?? "green",
          } as Stat;
        });

        const ordersQuery = query(
          collection(db, "orders"),
          orderBy("createdAt", "desc"),
          limit(7)
        );
        const ordersSnap = await getDocs(ordersQuery);
        const rawOrders: RawOrder[] = ordersSnap.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            customer: d.customerName ?? "Unknown",
            type: (d.type === "rent" ? "Rent" : "Buy") as Order["type"],
            amount: Number(d.price) || 0,
            status: normalizeStatus(d.status),
            eta: d.eta ?? "-",
            createdAt: d.createdAt?.toDate
              ? d.createdAt.toDate()
              : d.createdAt
              ? new Date(d.createdAt)
              : null,
          };
        });
        const orders = rawOrders.map(({ amount, ...rest }) => ({
          ...rest,
          total: `₦${amount.toLocaleString()}`,
        }));

        const productsQuery = query(
          collection(db, "products"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const productsSnap = await getDocs(productsQuery);
        const products = productsSnap.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            title: d.title ?? "Untitled",
            price: d.price ? `₦${Number(d.price).toLocaleString()}` : "₦0",
            category: d.category ?? "General",
            inStock: d.inStock !== false,
          };
        });

        const categoriesQuery = query(
          collection(db, "categories"),
          orderBy("count", "desc"),
          limit(6)
        );
        const categoriesSnap = await getDocs(categoriesQuery);
        const categories = categoriesSnap.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            name: d.name ?? "Category",
            segment: d.segment ?? "General",
            count: Number(d.count ?? d.total ?? 0),
            imageUrl: d.imageUrl,
          };
        });

        const opsSnap = await getDocs(collection(db, "operations"));
        const lanes = opsSnap.docs.map((doc) => {
          const d = doc.data();
          return { label: d.label ?? doc.id, value: d.value ?? 0 };
        });

        const alertsSnap = await getDocs(collection(db, "alerts"));
        const alerts = alertsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            title: d.title ?? "Alert",
            tone: (d.tone ?? "red") as Alert["tone"],
          };
        });

        const derivedStats = stats.length
          ? stats
          : buildStatsFromOrders(rawOrders);

        const derivedAlerts =
          alerts.length === 0
            ? buildAlertsFromData(rawOrders, products)
            : alerts;

        const revenueTrend = buildRevenueTrend(rawOrders, trendDays);
        const totals = buildRevenueTotals(rawOrders);

        if (!mounted) return;
        setData({
          stats: derivedStats,
          orders: orders.length ? orders : fallbackData.orders,
          products: products.length ? products : fallbackData.products,
          categories: categories.length ? categories : fallbackData.categories,
          lanes: lanes.length ? lanes : fallbackData.lanes,
          alerts: derivedAlerts.length ? derivedAlerts : fallbackData.alerts,
          revenueTrend: revenueTrend.length
            ? revenueTrend
            : fallbackData.revenueTrend,
        });
        setRevenueTotals(totals);
      } catch (err) {
        console.warn("Dashboard fetch failed", err);
        if (mounted) setError("Realtime data unavailable. Showing snapshot.");
        setData(fallbackData);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [trendDays]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {loading && (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/80 p-4 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
            Syncing live metrics from Firebase…
          </div>
        )}
        <motion.header
          className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo (1).png"
                alt="Sachio logo"
                width={42}
                height={42}
                className="rounded-lg"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Sachio Mobile Toilets
                </p>
                <h1 className="text-2xl font-black text-slate-900">
                  Operations Dashboard
                </h1>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Track revenue, orders, rentals, and delivery performance.
            </p>
            {role ? (
              <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                Logged in as{" "}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold">
                  {role}
                </span>
                {email ? (
                  <span className="text-[11px] text-slate-500">{email}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <motion.button
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
            >
              Export
            </motion.button>
            <motion.button
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
            >
              Logout
            </motion.button>
            {role === "superadmin" ? (
              <motion.button
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = "/staff/new")}
              >
                Manage staff
              </motion.button>
            ) : null}
            <motion.button
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => (window.location.href = "/announcements")}
            >
              Announcements
            </motion.button>
            <motion.button
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => (window.location.href = "/users")}
            >
              Users
            </motion.button>
            <motion.button
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAnnouncement}
              disabled={announcing}
            >
              {announcing ? "Posting..." : "New Announcement"}
            </motion.button>
          </div>
        </motion.header>

        {role === "staff" ? null : (
          <section className="grid gap-4 xs:grid-cols-2 lg:grid-cols-4">
            {data.stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${
                  stat.label === "Revenue (MTD)" ? "cursor-pointer" : ""
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{
                  y: -2,
                  boxShadow: "0px 8px 30px rgba(15, 23, 42, 0.08)",
                }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => {
                  if (stat.label === "Revenue (MTD)") {
                    setShowRevenueDetails(true);
                  }
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {stat.value}
                </p>
                {stat.delta ? (
                  <p
                    className={`mt-1 text-xs font-bold ${
                      stat.tone === "red"
                        ? "text-red-600"
                        : stat.tone === "orange"
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {stat.delta} vs last week
                  </p>
                ) : null}
              </motion.div>
            ))}
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          <motion.div
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{
              y: -2,
              boxShadow: "0px 10px 35px rgba(15,23,42,0.1)",
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Live Orders</h2>
              <button
                className="text-xs font-semibold text-emerald-700 hover:underline"
                onClick={() => (window.location.href = "/orders")}
              >
                View all
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="hidden w-full min-w-[600px] text-sm sm:table">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.005 }}
                      transition={{ duration: 0.2 }}
                      onClick={() =>
                        (window.location.href = `/orders/${order.id}`)
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {order.id}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {order.customer}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {order.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {order.total}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {order.eta}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-3 p-3 sm:hidden">
                {data.orders.map((order) => (
                  <motion.button
                    key={order.id}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    onClick={() =>
                      (window.location.href = `/orders/${order.id}`)
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {order.id}
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {order.customer}
                        </p>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {order.type}
                      </span>
                      <span className="text-slate-900">{order.total}</span>
                      <span className="text-slate-500">{order.eta}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{
              y: -3,
              boxShadow: "0px 10px 35px rgba(15,23,42,0.12)",
            }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">Categories</h2>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                  onClick={() => (window.location.href = "/categories")}
                >
                  Manage categories
                </button>
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  onClick={() => (window.location.href = "/categories/new")}
                >
                  Add category
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="hidden w-full min-w-[280px] text-sm sm:table">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        (window.location.href = `/categories/${category.id}`)
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                            {category.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {category.name}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-3 p-3 sm:hidden">
                {data.categories.map((category) => (
                  <button
                    key={category.id}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100"
                    onClick={() =>
                      (window.location.href = `/categories/${category.id}`)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {category.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="font-semibold text-slate-900">
                        {category.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {role === "staff" ? null : (
            <motion.div
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{
                y: -2,
                boxShadow: "0px 10px 35px rgba(15,23,42,0.1)",
              }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">Products</h2>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                    onClick={() => (window.location.href = "/products")}
                  >
                    View all
                  </button>
                  <button
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    onClick={() => (window.location.href = "/products/new")}
                  >
                    Add product
                  </button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="hidden w-full min-w-[500px] text-sm sm:table">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product) => (
                      <tr
                        key={product.id}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 transition"
                        onClick={() =>
                          (window.location.href = `/products/${product.id}`)
                        }
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {product.title}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {product.category}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {product.price}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              product.inStock
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {product.inStock ? "In stock" : "Out"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-3 p-3 sm:hidden">
                  {data.products.map((product) => (
                    <motion.button
                      key={product.id}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100"
                      whileHover={{ scale: 1.01 }}
                      onClick={() =>
                        (window.location.href = `/products/${product.id}`)
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {product.title}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                          {product.category}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="text-slate-900">{product.price}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            product.inStock
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {product.inStock ? "In stock" : "Out"}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{
              y: -2,
              boxShadow: "0px 10px 35px rgba(15,23,42,0.1)",
            }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Operational Health
              </h2>
              <span className="text-xs font-semibold text-emerald-700">
                Live
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {data.lanes.map((lane) => (
                <div key={lane.label}>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{lane.label}</span>
                    <span>{lane.value}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <motion.div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${lane.value}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {role === "staff" ? null : (
            <motion.div
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{
                y: -2,
                boxShadow: "0px 10px 35px rgba(15,23,42,0.1)",
              }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Revenue Trend
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Range
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    value={trendDays}
                    onChange={(e) => setTrendDays(Number(e.target.value))}
                  >
                    {trendOptions.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-7">
                {(() => {
                  const maxValue = Math.max(
                    ...data.revenueTrend.map((p) => p.value),
                    1
                  );
                  return data.revenueTrend.map((point, i) => {
                    const height = Math.round((point.value / maxValue) * 100);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="flex h-32 w-full items-end rounded-lg bg-slate-200 overflow-hidden">
                          <motion.div
                            className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-teal-500"
                            initial={{ height: "0%" }}
                            animate={{ height: `${height}%` }}
                            transition={{ delay: i * 0.05, type: "spring" }}
                            title={`₦${point.value.toLocaleString()}`}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {point.label}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}
          <motion.div
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold text-slate-900">Alerts</h2>
              <span className="text-xs font-semibold text-red-600">
                {data.alerts.length}
              </span>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              {data.alerts.map((alert, idx) => (
                <AlertItem key={idx} title={alert.title} tone={alert.tone} />
              ))}
            </div>
          </motion.div>
        </section>

        {showRevenueDetails ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <motion.div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Revenue
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">
                    Completed orders only
                  </h3>
                </div>
                <button
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => setShowRevenueDetails(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Today
                  </span>
                  <span className="text-base font-black text-slate-900">
                    NGN {revenueTotals.daily.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">
                    This Month
                  </span>
                  <span className="text-base font-black text-slate-900">
                    NGN {revenueTotals.monthly.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">
                    This Year
                  </span>
                  <span className="text-base font-black text-slate-900">
                    NGN {revenueTotals.yearly.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Totals are based on orders with status{" "}
                <strong>Completed</strong>.
              </p>
            </motion.div>
          </div>
        ) : null}
        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const normalized = status.replace(/_/g, " ");
  const label = normalized.replace(/\b\w/g, (c) => c.toUpperCase());
  const map: Record<string, string> = {
    Processing: "bg-amber-100 text-amber-700",
    Dispatched: "bg-blue-100 text-blue-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-red-100 text-red-700",
    "Cancelled by admin": "bg-red-100 text-red-700",
    "Cancelled By Admin": "bg-red-100 text-red-700",
    "In transit": "bg-indigo-100 text-indigo-700",
    Completed: "bg-emerald-100 text-emerald-700",
  };
  const colors = map[label] || "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors}`}>
      {label}
    </span>
  );
}

function AlertItem({
  title,
  tone,
}: {
  title: string;
  tone: "red" | "amber" | "emerald";
}) {
  const colors =
    tone === "red"
      ? "bg-red-50 text-red-700 ring-red-100"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-emerald-50 text-emerald-700 ring-emerald-100";
  return (
    <motion.button
      type="button"
      className={`w-full rounded-xl border border-transparent px-3 py-2 text-left text-xs font-semibold ring-1 transition hover:brightness-95 ${colors}`}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => {
        if (title.toLowerCase().includes("product")) {
          window.location.href = "/products";
        } else if (
          title.toLowerCase().includes("order") ||
          title.toLowerCase().includes("delivery")
        ) {
          window.location.href = "/orders";
        }
      }}
    >
      {title}
    </motion.button>
  );
}

function normalizeStatus(value: unknown): OrderStatus {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw.replace(/[_-]+/g, " ").trim().toLowerCase();
  const map: Record<string, OrderStatus> = {
    processing: "Processing",
    dispatched: "Dispatched",
    delivered: "Delivered",
    cancelled: "Cancelled",
    "cancelled by admin": "Cancelled_by_admin",
    "cancelled-by-admin": "Cancelled_by_admin",
    cancelled_by_admin: "Cancelled_by_admin",
    "in transit": "In transit",
    "in-transit": "In transit",
    completed: "Completed",
  };
  return map[normalized] ?? "Processing";
}

function buildAlertsFromData(orders: RawOrder[], products: Product[]) {
  const alerts: Alert[] = [];
  const lowStock = products.filter((p) => !p.inStock);
  if (lowStock.length) {
    alerts.push({
      title: `${lowStock.length} product${
        lowStock.length > 1 ? "s" : ""
      } out of stock`,
      tone: "red",
    });
  }
  const backlog = orders.filter((o) =>
    o.status.toLowerCase().includes("processing")
  ).length;
  if (backlog > 6) {
    alerts.push({
      title: `${backlog} orders waiting on fulfillment`,
      tone: "amber",
    });
  }
  const cancelled = orders.filter((o) =>
    o.status.toLowerCase().includes("cancel")
  ).length;
  if (orders.length && cancelled / orders.length > 0.2) {
    alerts.push({
      title: "Cancellation rate above 20%",
      tone: "red",
    });
  }
  const inTransit = orders.filter((o) =>
    o.status.toLowerCase().includes("in transit")
  ).length;
  if (inTransit > 0) {
    alerts.push({
      title: `${inTransit} deliveries currently in transit`,
      tone: "emerald",
    });
  }
  return alerts;
}

function buildRevenueTrend(orders: RawOrder[], windowDays = 7): TrendPoint[] {
  const today = new Date();
  const buckets: Record<string, TrendPoint> = {};
  const span = Math.max(1, windowDays - 1);
  for (let i = span; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    buckets[key] = {
      label: date.toLocaleDateString("en-NG", { weekday: "short" }),
      value: 0,
    };
  }

  orders.forEach((order) => {
    if (!order.createdAt) return;
    const key = order.createdAt.toISOString().slice(0, 10);
    if (buckets[key]) {
      buckets[key].value += order.amount;
    }
  });

  return Object.values(buckets);
}

function buildRevenueTotals(orders: RawOrder[]): RevenueTotals {
  const today = new Date();
  const isSameDay = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isSameMonth = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth();
  const isSameYear = (d: Date) => d.getFullYear() === today.getFullYear();

  const completed = orders.filter(
    (o) => o.status === "Completed" && o.createdAt instanceof Date
  );

  const daily = completed
    .filter((o) => o.createdAt && isSameDay(o.createdAt))
    .reduce((sum, o) => sum + o.amount, 0);
  const monthly = completed
    .filter((o) => o.createdAt && isSameMonth(o.createdAt))
    .reduce((sum, o) => sum + o.amount, 0);
  const yearly = completed
    .filter((o) => o.createdAt && isSameYear(o.createdAt))
    .reduce((sum, o) => sum + o.amount, 0);

  return { daily, monthly, yearly };
}

function buildSimplePdf(lines: string[]) {
  // Minimal PDF generator for text content only (Helvetica, single page).
  const sanitize = (text: string) => text.replace(/[^\x20-\x7E]/g, "?");
  const wrapText = (text: string, max = 90) => {
    const words = sanitize(text).split(" ");
    const wrapped: string[] = [];
    let line = "";
    words.forEach((word) => {
      if ((line + word).length > max) {
        wrapped.push(line.trimEnd());
        line = "";
      }
      line += (line ? " " : "") + word;
    });
    if (line) wrapped.push(line);
    return wrapped.length ? wrapped : [""];
  };
  const contentLines = lines.flatMap((line) => wrapText(line));
  const content: string[] = [];
  content.push("BT");
  content.push("/F1 12 Tf");
  content.push("14 TL");
  content.push("72 760 Td");
  contentLines.forEach((line, idx) => {
    content.push(`(${line || " "}) Tj`);
    if (idx < contentLines.length - 1) {
      content.push("T*");
    }
  });
  content.push("ET");
  const contentStream = content.join("\n");

  const objects: string[] = [];
  const offsets: number[] = [];
  let pdf = "%PDF-1.4\n";
  const addObject = (obj: string) => {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  };

  addObject("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  addObject("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  addObject(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj"
  );
  addObject(
    `4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`
  );
  addObject(
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
  );

  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${offsets.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${
    offsets.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildStatsFromOrders(orders: RawOrder[]) {
  const today = new Date();
  const isSameMonth = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth();
  const completed = orders.filter(
    (o) =>
      o.status === "Completed" &&
      o.createdAt instanceof Date &&
      isSameMonth(o.createdAt)
  );
  const revenue = completed.reduce((sum, order) => sum + order.amount, 0);
  const rentals = orders.filter(
    (o) => o.type === "Rent" && !o.status.toLowerCase().includes("cancelled")
  ).length;
  const delivered = orders.filter(
    (o) => o.status === "Delivered" || o.status === "Completed"
  ).length;
  const onTime = orders.length
    ? Math.round((delivered / orders.length) * 100)
    : 0;
  return [
    {
      label: "Revenue (MTD)",
      value: `NGN ${revenue.toLocaleString()}`,
      delta: "",
      tone: "green" as const,
    },
    { label: "Orders", value: `${orders.length}`, delta: "" },
    { label: "Rentals in progress", value: `${rentals}`, delta: "" },
    {
      label: "On-time delivery",
      value: `${onTime}%`,
      delta: "",
      tone: "green" as const,
    },
  ];
}
