"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Image from "next/image";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import emailjs from "@emailjs/browser";

declare global {
  interface Window {
    google?: any;
  }
}

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
type DriverInfo = { id: string; name: string; email?: string | null; active?: boolean };
type DriverLocation = {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  updatedAt?: Date | null;
};

const trendOptions = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
];

const ADMIN_UIDS = [
  "GSPPzYGp20aBdNNkOenJjOFOUsy1",
  "LT2b0m9GGPQMA4OGE8NNJtqM8iZ2",
] as const;
const ADMIN_EMAILS = [
  "hello@sachioexpress.com",
  "arnoldcharles028@gmail.com",
] as const;
const EMAILJS_SERVICE_ID = "service_hze1iqq";
const EMAILJS_TEMPLATE_ID = "template_qka2ktc";
const EMAILJS_PUBLIC_KEY = "oVbvaRgeYvDKm2Hwa";

type OrderNotifyEvent = "new" | "paid" | "cancelled";

function normalizeOrderSignal(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function isPaidOrderSignal(status: unknown, paymentStatus: unknown) {
  return (
    normalizeOrderSignal(status).includes("paid") ||
    normalizeOrderSignal(paymentStatus).includes("paid")
  );
}

function isCancelledOrderSignal(status: unknown) {
  return normalizeOrderSignal(status).includes("cancel");
}
const motivationLines = [
  "Keep the day moving; your decisions set the pace.",
  "Small wins stack up into smooth operations.",
  "Every order handled well builds loyal clients.",
  "Clear updates keep the whole team aligned.",
  "Lead with calm, execute with precision.",
  "Great service is built in the details.",
  "Tidy schedules, tidy outcomes.",
  "Make today easy for customers and staff.",
  "Stay consistent; trust follows.",
  "Sharp focus turns pressure into progress.",
  "Your planning saves hours later.",
  "Every resolved issue raises the bar.",
  "Steady progress beats rushed fixes.",
  "Your leadership keeps things moving.",
  "Make it smooth, make it reliable.",
  "Hold the standard; quality shows.",
  "Focus on the next best action.",
  "Fast response builds confidence.",
  "Great ops looks effortless to customers.",
  "Protect the schedule; protect the brand.",
  "Every delivery is a chance to impress.",
  "Be proactive; prevent surprises.",
  "Consistency wins long-term trust.",
  "Clean execution is the best marketing.",
  "Stay sharp, stay steady.",
  "Good data makes great decisions.",
  "Clarity today prevents chaos tomorrow.",
  "Your attention keeps the system healthy.",
  "Service first; results follow.",
  "You are building a dependable operation.",
];
const fridayLines = [
  "Wrap the week strong and smooth.",
  "Finish proud and set up an easy Monday.",
  "Close the week with clean execution.",
  "End the week with calm, clear updates.",
  "You earned the momentum; keep it steady.",
  "Leave no loose ends and rest easy.",
  "Strong finishes build stronger weeks.",
  "Keep the tempo and deliver the details.",
];
const saturdayLines = [
  "Keep service steady; weekends show the standard.",
  "Today is about consistency and care.",
  "Stay sharp and keep it simple.",
  "A smooth Saturday earns big trust.",
  "Handle the rush with calm focus.",
  "Weekend wins are built on basics.",
  "Stay proactive and protect the schedule.",
  "Make it easy for customers today.",
];
const sundayLines = [
  "Keep it light and reliable today.",
  "Stay calm and finish clean.",
  "Set up the week with a smooth close.",
  "Today is for steady, thoughtful execution.",
  "Quiet focus delivers big results.",
  "Make it a clean, confident finish.",
  "A steady Sunday sets the tone for Monday.",
  "Keep it simple and strong.",
];

function computeOperationalHealth(
  orders: RawOrder[],
  products: Product[],
  alerts: Alert[]
): Lane[] {
  const totalProducts = products.length;
  const inStock = products.filter((product) => product.inStock).length;
  const fleetReadiness = totalProducts
    ? Math.round((inStock / totalProducts) * 100)
    : 0;

  const totalOrders = orders.length;
  const completed = orders.filter((order) =>
    ["Completed", "Delivered"].includes(order.status)
  ).length;
  const sanitationCycle = totalOrders
    ? Math.round((completed / totalOrders) * 100)
    : 0;

  const cancelled = orders.filter((order) =>
    order.status.toLowerCase().includes("cancel")
  ).length;
  const dispatchReliability = totalOrders
    ? Math.round(((totalOrders - cancelled) / totalOrders) * 100)
    : 0;

  const supportLoad = Math.max(0, 100 - alerts.length * 12);

  return [
    { label: "Fleet Readiness", value: fleetReadiness },
    { label: "Sanitation Cycle", value: sanitationCycle },
    { label: "Dispatch Reliability", value: dispatchReliability },
    { label: "Customer Support Load", value: supportLoad },
  ];
}

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
  const [trendDays, setTrendDays] = useState<number>(7);
  const [role, setRole] = useState<"superadmin" | "staff" | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMobileSection, setActiveMobileSection] = useState<string | null>(
    "orders"
  );
  const [showMobileTrend, setShowMobileTrend] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastOpsSync = useRef<string>("");
  const rawOrdersRef = useRef<RawOrder[]>([]);
  const productsRef = useRef<Product[]>([]);
  const alertsRef = useRef<Alert[]>([]);
  const orderSignalRef = useRef<Record<string, { paid: boolean; cancelled: boolean }>>({});
  const orderWatcherReadyRef = useRef(false);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<"light" | "dark">("light");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<any[]>([]);
  const [revenueTotals, setRevenueTotals] = useState<RevenueTotals>({
    daily: 0,
    monthly: 0,
    yearly: 0,
  });
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const mapsKeyMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const placesKeyMissing = !process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
    const storedTheme = localStorage.getItem("sachio_dashboard_theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("sachio_dashboard_theme", theme);
    document.documentElement.classList.toggle(
      "dashboard-theme-dark",
      theme === "dark"
    );
    document.body.classList.toggle("dashboard-theme-dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setMapStyleMode(theme === "dark" ? "dark" : "light");
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapsKeyMissing) return;
    let cancelled = false;
    const load = async () => {
      if (window.google?.maps) {
        if (!cancelled) setMapReady(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => {
        if (!cancelled) setMapReady(true);
      };
      script.onerror = () => {
        if (!cancelled) setMapReady(false);
      };
      document.head.appendChild(script);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mapsKeyMissing]);

  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: 6.5244, lng: 3.3792 },
      zoom: 11,
      styles: mapStyleMode === "dark" ? darkMapStyle : lightMapStyle,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;
    clustererRef.current = new MarkerClusterer({ map, markers: [] });
  }, [mapReady, mapStyleMode]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({
      styles: mapStyleMode === "dark" ? darkMapStyle : lightMapStyle,
    });
  }, [mapStyleMode]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    if (markersRef.current.length) {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    }
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    const activeMarkers: any[] = [];
    drivers.forEach((driver) => {
      const location = driverLocations[driver.id];
      if (!location) return;
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        title: driver.name,
        label: driver.name ? driver.name.charAt(0).toUpperCase() : "D",
      });
      activeMarkers.push(marker);
    });
    markersRef.current = activeMarkers;
    if (clustererRef.current) {
      clustererRef.current.addMarkers(activeMarkers);
    }
    if (activeMarkers.length === 1) {
      mapInstanceRef.current.setCenter(activeMarkers[0].getPosition());
      mapInstanceRef.current.setZoom(13);
    }
  }, [drivers, driverLocations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const greetingText =
      hour < 12
        ? "Good morning"
        : hour < 17
        ? "Good afternoon"
        : "Good evening";
    const dayPrefix =
      day === 5 ? "Yay it's Friday." : day === 6 ? "Happy Saturday." : day === 0 ? "Happy Sunday." : "";
    const activeLines =
      day === 5 ? fridayLines : day === 6 ? saturdayLines : day === 0 ? sundayLines : motivationLines;
    let index = hour % activeLines.length;
    const updateGreeting = () => {
      const message = activeLines[index % activeLines.length];
      const parts = [greetingText + ".", dayPrefix, message].filter(Boolean);
      setGreeting(parts.join(" "));
      index += 1;
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 65000);
    return () => clearInterval(interval);
  }, []);

  const summaryStats = useMemo(() => {
    const getValue = (label: string) =>
      data.stats.find((stat) => stat.label === label)?.value ?? "—";
    return {
      revenue: getValue("Revenue (MTD)"),
      orders: getValue("Orders"),
      rentals: getValue("Rentals in progress"),
    };
  }, [data.stats]);

  const sparklineValues = useMemo(
    () => data.revenueTrend.map((point) => point.value),
    [data.revenueTrend]
  );

  const sparklineForIndex = (index: number) => {
    if (!sparklineValues.length) return [];
    const offset = index % sparklineValues.length;
    return [
      ...sparklineValues.slice(offset),
      ...sparklineValues.slice(0, offset),
    ];
  };

  const toggleMobileSection = (id: string) => {
    setActiveMobileSection((prev) => (prev === id ? null : id));
  };

  const syncOperationalHealth = async (lanes: Lane[]) => {
    const payload = JSON.stringify(lanes);
    if (payload === lastOpsSync.current) return;
    lastOpsSync.current = payload;
    try {
      await Promise.all(
        lanes.map((lane) =>
          setDoc(
            doc(db, "operations", lane.label.toLowerCase().replace(/\s+/g, "_")),
            {
              label: lane.label,
              value: lane.value,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );
    } catch (err) {
      console.warn("Operational health sync failed", err);
    }
  };

  const renderMobileSection = (
    id: string,
    title: string,
    subtitle: string,
    content: React.ReactNode
  ) => (
    <motion.div
      key={id}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => toggleMobileSection(id)}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {subtitle}
          </p>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <span
          className={`text-base text-slate-500 transition ${
            activeMobileSection === id ? "rotate-180" : ""
          }`}
        >
          ˅
        </span>
      </button>
      <AnimatePresence initial={false}>
        {activeMobileSection === id ? (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="pt-3">{content}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );

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

  const buildOrderEmailContent = (event: OrderNotifyEvent, orderId: string, data: Record<string, any>) => {
    const customerName = data.customerName || data.name || "Unknown customer";
    const status = normalizeOrderSignal(data.status || "unknown");
    const typeLabel = String(data.type || "order").toLowerCase().includes("rent")
      ? "Rental"
      : "Order";
    const amount = data.amount ?? data.price ?? data.total;
    const amountText =
      amount == null || amount === "" ? "N/A" : `NGN ${Number(amount).toLocaleString()}`;
    const eventLabel =
      event === "new" ? "New order received" : event === "paid" ? "Order paid" : "Order cancelled";
    const subject = `[Sachio] ${eventLabel} - ${orderId}`;
    const text = [
      `${eventLabel}`,
      `Order ID: ${orderId}`,
      `Type: ${typeLabel}`,
      `Customer: ${customerName}`,
      `Status: ${status || "unknown"}`,
      `Amount: ${amountText}`,
    ].join("\n");
    return { subject, text, customerName, status, typeLabel, amountText, eventLabel };
  };

  const sendViaEmailJs = async (event: OrderNotifyEvent, orderId: string, data: Record<string, any>) => {
    const payload = buildOrderEmailContent(event, orderId, data);
    const numericAmount = Number(data.amount ?? data.price ?? data.total ?? 0) || 0;
    const orderTitle =
      data.productTitle || data.title || data.productId || payload.typeLabel;
    const eventIntro =
      event === "new"
        ? "A new order has been created."
        : event === "paid"
        ? "An order has been marked as paid."
        : "An order has been cancelled.";
    try {
      await Promise.all(
        ADMIN_EMAILS.map((toEmail) =>
          emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_email: toEmail,
              email: toEmail,
              title: payload.eventLabel,
              intro: eventIntro,
              logo_url: "https://sachioexpress.com/logo.png",
              order_id: orderId,
              orders: [
                {
                  name: orderTitle,
                  image_url:
                    data.imageUrl || data.productImage || "https://sachioexpress.com/logo.png",
                  units: Number(data.quantity || 1),
                  price: numericAmount.toFixed(2),
                },
              ],
              cost: {
                shipping: Number(data.shipping || 0).toFixed(2),
                tax: Number(data.tax || 0).toFixed(2),
                total: numericAmount.toFixed(2),
              },
            },
            { publicKey: EMAILJS_PUBLIC_KEY }
          )
        )
      );
    } catch (err) {
      console.warn("EmailJS fallback failed", err);
    }
  };

  const notifyOrderEventWithEmailJs = async (
    event: OrderNotifyEvent,
    orderId: string,
    data: Record<string, any>
  ) => {
    await sendViaEmailJs(event, orderId, data);
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
    let unsubscribeOrders: (() => void) | null = null;
    let unsubscribeProducts: (() => void) | null = null;
    let unsubscribeAlerts: (() => void) | null = null;
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
        productsRef.current = products;

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

        const alertsSnap = await getDocs(collection(db, "alerts"));
        const alerts = alertsSnap.docs.map((doc) => {
          const d = doc.data();
          return {
            title: d.title ?? "Alert",
            tone: (d.tone ?? "red") as Alert["tone"],
          };
        });
        alertsRef.current = alerts;

        const derivedStats = stats.length
          ? stats
          : buildStatsFromOrders(rawOrders);

        const derivedAlerts =
          alerts.length === 0
            ? buildAlertsFromData(rawOrders, products)
            : alerts;

        const lanes = computeOperationalHealth(rawOrders, products, derivedAlerts);

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
        setLastUpdated(new Date());
        await syncOperationalHealth(lanes);
      } catch (err) {
        console.warn("Dashboard fetch failed", err);
        if (mounted) setError("Realtime data unavailable. Showing snapshot.");
        setData(fallbackData);
        setLastUpdated(new Date());
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const ordersQueryLive = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(7)
    );
    unsubscribeOrders = onSnapshot(
      ordersQueryLive,
      (snapshot) => {
        if (!mounted) return;
        const currentIds = new Set<string>();
        snapshot.docs.forEach((docSnap) => {
          currentIds.add(docSnap.id);
          const d = docSnap.data() as any;
          const nextPaid = isPaidOrderSignal(d.status, d.paymentStatus);
          const nextCancelled = isCancelledOrderSignal(d.status);
          const prev = orderSignalRef.current[docSnap.id];
          const canNotify = orderWatcherReadyRef.current;

          if (!prev) {
            orderSignalRef.current[docSnap.id] = {
              paid: nextPaid,
              cancelled: nextCancelled,
            };
            if (canNotify) {
              notifyOrderEventWithEmailJs("new", docSnap.id, d);
            }
            return;
          }

          if (canNotify && !prev.paid && nextPaid) {
            notifyOrderEventWithEmailJs("paid", docSnap.id, d);
          }
          if (canNotify && !prev.cancelled && nextCancelled) {
            notifyOrderEventWithEmailJs("cancelled", docSnap.id, d);
          }

          orderSignalRef.current[docSnap.id] = {
            paid: nextPaid,
            cancelled: nextCancelled,
          };
        });
        Object.keys(orderSignalRef.current).forEach((id) => {
          if (!currentIds.has(id)) {
            delete orderSignalRef.current[id];
          }
        });
        if (!orderWatcherReadyRef.current) {
          orderWatcherReadyRef.current = true;
        }

        const rawOrders: RawOrder[] = snapshot.docs.map((doc) => {
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
          total: `ƒ,İ${amount.toLocaleString()}`,
        }));
        rawOrdersRef.current = rawOrders;
        setData((prev) => ({ ...prev, orders }));
        const lanes = computeOperationalHealth(rawOrders, data.products, data.alerts);
        setData((prev) => ({ ...prev, lanes }));
        setRevenueTotals(buildRevenueTotals(rawOrders));
        setLastUpdated(new Date());
        syncOperationalHealth(lanes);
      },
      (err) => console.warn("Orders live update failed", err)
    );

    const productsQueryLive = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    unsubscribeProducts = onSnapshot(
      productsQueryLive,
      (snapshot) => {
        if (!mounted) return;
        const products = snapshot.docs.map((doc) => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            title: d.title ?? "Untitled",
            price: d.price ? `ƒ,İ${Number(d.price).toLocaleString()}` : "ƒ,İ0",
            category: d.category ?? "General",
            inStock: d.inStock !== false,
          };
        });
        setData((prev) => ({ ...prev, products }));
        const lanes = computeOperationalHealth(data.orders.map((o) => ({
          id: o.id,
          customer: o.customer,
          type: o.type,
          amount: Number(o.total.replace(/[^\d.]/g, "")) || 0,
          status: o.status,
          eta: o.eta,
          createdAt: null,
        })), products, data.alerts);
        setData((prev) => ({ ...prev, lanes }));
        setLastUpdated(new Date());
        syncOperationalHealth(lanes);
      },
      (err) => console.warn("Products live update failed", err)
    );

    const alertsQueryLive = query(collection(db, "alerts"));
    unsubscribeAlerts = onSnapshot(
      alertsQueryLive,
      (snapshot) => {
        if (!mounted) return;
        const alerts = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            title: d.title ?? "Alert",
            tone: (d.tone ?? "red") as Alert["tone"],
          };
        });
        alertsRef.current = alerts;
        const lanes = computeOperationalHealth(
          rawOrdersRef.current,
          productsRef.current,
          alerts
        );
        setData((prev) => ({ ...prev, alerts, lanes }));
        setLastUpdated(new Date());
        syncOperationalHealth(lanes);
      },
      (err) => console.warn("Alerts live update failed", err)
    );
    return () => {
      mounted = false;
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeAlerts) unsubscribeAlerts();
    };
  }, [trendDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const driversQuery = query(
      collection(db, "users"),
      where("isDriver", "==", true)
    );
    const unsubscribeDrivers = onSnapshot(
      driversQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: data.name || data.fullName || data.email || docSnap.id,
            email: data.email ?? null,
            active: Boolean(data.isDriverActive),
          } as DriverInfo;
        });
        setDrivers(rows);
      },
      () => setDrivers([])
    );

    const locationsQuery = collection(db, "driverLocations");
    const unsubscribeLocations = onSnapshot(
      locationsQuery,
      (snapshot) => {
        const locations: Record<string, DriverLocation> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (typeof data?.lat !== "number" || typeof data?.lng !== "number") return;
          const updatedAt = data?.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : typeof data?.updatedAt?.seconds === "number"
            ? new Date(data.updatedAt.seconds * 1000)
            : typeof data?.updatedAt === "number"
            ? new Date(data.updatedAt)
            : null;
          locations[docSnap.id] = {
            lat: data.lat,
            lng: data.lng,
            speed: typeof data?.speed === "number" ? data.speed : null,
            heading: typeof data?.heading === "number" ? data.heading : null,
            updatedAt,
          };
        });
        setDriverLocations(locations);
      },
      () => setDriverLocations({})
    );

    return () => {
      unsubscribeDrivers();
      unsubscribeLocations();
    };
  }, []);

  const driverCards = useMemo(() => {
    return drivers.map((driver) => {
      const location = driverLocations[driver.id];
      const updatedAt = location?.updatedAt ?? null;
      const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : Infinity;
      const status =
        ageMs > 5 * 60 * 1000
          ? "Offline"
          : location?.speed != null && location.speed < 0.5
          ? "Idle"
          : "Active";
      return { driver, status, updatedAt };
    });
  }, [drivers, driverLocations]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6 sm:px-6 lg:gap-6 lg:px-8">
        {loading && (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/80 p-4 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
            Syncing live metrics from Firebase…
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
              <motion.div
                className="h-full w-1/3 rounded-full bg-emerald-500"
                initial={{ x: "-100%" }}
                animate={{ x: "300%" }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>
        )}
        {(mapsKeyMissing || placesKeyMissing) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
            Google Maps keys missing. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`{placesKeyMissing ? " and `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`" : ""} to `.env.local` (and Vercel envs) to enable map features.
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
            <AnimatePresence mode="wait">
              {greeting ? (
                <motion.p
                  key={greeting}
                  className="mt-2 text-sm font-semibold text-slate-700"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  {greeting}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {lastUpdated ? (
                <motion.span
                  key={lastUpdated.getTime()}
                  className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  suppressHydrationWarning
                >
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString("en-NG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </motion.span>
              ) : null}
            </AnimatePresence>
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
        </motion.header>

        <div className="sticky top-0 z-20 -mx-4 px-4 lg:hidden">
          <motion.div
            className="rounded-2xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Today’s summary
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-slate-500">Revenue</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {summaryStats.revenue}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-slate-500">Orders</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {summaryStats.orders}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-slate-500">Rentals</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {summaryStats.rentals}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.section
          className="hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:block"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Control Bar
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                Quick actions and settings
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExport}
              >
                Export
              </motion.button>
              <motion.button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = "/announcements")}
              >
                Announcements
              </motion.button>
              <motion.button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = "/users")}
              >
                Users
              </motion.button>
              {role === "superadmin" ? (
                <motion.button
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => (window.location.href = "/staff/new")}
                >
                  Manage staff
                </motion.button>
              ) : null}
              <motion.button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
              >
                Logout
              </motion.button>
            </div>
            <div className="flex items-center gap-3" suppressHydrationWarning>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Theme
              </span>
              <div className="flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (mounted ? theme : "light") === "light"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                  onClick={() => setTheme("light")}
                  type="button"
                >
                  Light
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (mounted ? theme : "light") === "dark"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600"
                  }`}
                  onClick={() => setTheme("dark")}
                  type="button"
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-3 lg:hidden">
          {renderMobileSection(
            "orders",
            "Live Orders",
            "Latest updates",
            <div className="space-y-2">
              {data.orders.length ? (
                <>
                  {data.orders.map((order) => (
                    <button
                      key={order.id}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs shadow-sm"
                      onClick={() =>
                        (window.location.href = `/orders/${order.id}`)
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {order.id}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {order.customer}
                          </p>
                        </div>
                        <StatusPillWithPulse status={order.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {order.type}
                        </span>
                        <span className="font-bold text-slate-900">
                          {order.total}
                        </span>
                        <span className="text-slate-500">{order.eta}</span>
                      </div>
                    </button>
                  ))}
                  <button
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    onClick={() => (window.location.href = "/orders")}
                  >
                    View all orders
                  </button>
                </>
              ) : (
                <EmptyState
                  title="No orders yet"
                  detail="New orders will appear here once created."
                />
              )}
            </div>
          )}

          {renderMobileSection(
            "products",
            "Products",
            "Inventory",
            <div className="space-y-2">
              {data.products.length ? (
                <>
                  {data.products.map((product) => (
                    <button
                      key={product.id}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs shadow-sm"
                      onClick={() =>
                        (window.location.href = `/products/${product.id}`)
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {product.title}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {product.category}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-bold text-slate-900">
                          {product.price}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            product.inStock
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {product.inStock ? "In stock" : "Out"}
                        </span>
                      </div>
                    </button>
                  ))}
                  <button
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    onClick={() => (window.location.href = "/products")}
                  >
                    View all products
                  </button>
                </>
              ) : (
                <EmptyState
                  title="No products yet"
                  detail="Add products to populate this list."
                />
              )}
            </div>
          )}

          {renderMobileSection(
            "categories",
            "Categories",
            "Segments",
            <div className="space-y-2">
              {data.categories.length ? (
                <>
                  {data.categories.map((category) => (
                    <button
                      key={category.id}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs shadow-sm"
                      onClick={() =>
                        (window.location.href = `/categories/${category.id}`)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">
                          {category.name}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {category.count ?? 0}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {category.segment ?? "General"}
                      </p>
                    </button>
                  ))}
                  <button
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    onClick={() => (window.location.href = "/categories")}
                  >
                    View categories
                  </button>
                </>
              ) : (
                <EmptyState
                  title="No categories yet"
                  detail="Create categories to organize products."
                />
              )}
            </div>
          )}

          {renderMobileSection(
            "gallery",
            "Gallery",
            "Mobile app",
            <div className="flex flex-col gap-2">
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => (window.location.href = "/gallery/new")}
              >
                Add gallery item
              </button>
              <button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                onClick={() => (window.location.href = "/gallery")}
              >
                View gallery
              </button>
            </div>
          )}

          {renderMobileSection(
            "alerts",
            "Alerts",
            "Attention needed",
            <div className="space-y-2">
              {data.alerts.length ? (
                data.alerts.map((alert, idx) => (
                  <AlertItem key={idx} title={alert.title} tone={alert.tone} />
                ))
              ) : (
                <EmptyState
                  title="No alerts right now"
                  detail="All operational areas look healthy."
                />
              )}
            </div>
          )}
        </section>

        <motion.section
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Revenue trend
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                Performance chart
              </h3>
            </div>
            <button
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
              onClick={() => setShowMobileTrend((prev) => !prev)}
            >
              {showMobileTrend ? "Hide chart" : "View chart"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showMobileTrend ? (
              <motion.div
                className="mt-4 grid grid-cols-4 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {(() => {
                  const maxValue = Math.max(
                    ...data.revenueTrend.map((point) => point.value),
                    1
                  );
                  return data.revenueTrend.slice(-8).map((point, i) => {
                    const height = Math.round((point.value / maxValue) * 100);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="flex h-16 w-full items-end rounded-lg bg-slate-200 overflow-hidden">
                          <motion.div
                            className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-teal-500"
                            initial={{ height: "0%" }}
                            animate={{ height: `${height}%` }}
                            transition={{ delay: i * 0.03, type: "spring" }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {point.label}
                        </span>
                      </div>
                    );
                  });
                })()}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.section>

        <AnimatePresence>
          {sidebarOpen ? (
            <div className="lg:hidden">
              <motion.button
                type="button"
                className="fixed inset-0 z-40 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              />
              <motion.aside
                className="fixed right-0 top-0 z-50 h-full w-[78%] max-w-[320px] overflow-y-auto bg-white p-5 shadow-2xl ring-1 ring-slate-200"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Control Bar
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">Menu</h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => setSidebarOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="mt-5 space-y-3">
                  <motion.button
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSidebarOpen(false);
                      handleExport();
                    }}
                  >
                    Export
                  </motion.button>
                  <motion.button
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSidebarOpen(false);
                      window.location.href = "/announcements";
                    }}
                  >
                    Announcements
                  </motion.button>
                  <motion.button
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSidebarOpen(false);
                      window.location.href = "/users";
                    }}
                  >
                    Users
                  </motion.button>
                  {role === "superadmin" ? (
                    <motion.button
                      className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSidebarOpen(false);
                        window.location.href = "/staff/new";
                      }}
                    >
                      Manage staff
                    </motion.button>
                  ) : null}
                  <motion.button
                    className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSidebarOpen(false);
                      handleLogout();
                    }}
                  >
                    Logout
                  </motion.button>
                </div>
                <div className="mt-6 border-t border-slate-200 pt-4" suppressHydrationWarning>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Theme
                  </p>
                  <div className="mt-3 flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
                    <button
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                        (mounted ? theme : "light") === "light"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600"
                      }`}
                      onClick={() => setTheme("light")}
                      type="button"
                    >
                      Light
                    </button>
                    <button
                      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                        (mounted ? theme : "light") === "dark"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600"
                      }`}
                      onClick={() => setTheme("dark")}
                      type="button"
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </motion.aside>
            </div>
          ) : null}
        </AnimatePresence>

        {role === "staff" ? null : (
          <section className="grid gap-3 xs:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {data.stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${
                  stat.label === "Revenue (MTD)" ? "cursor-pointer" : ""
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{
                  y: -3,
                  rotateX: 2,
                  rotateY: -2,
                  boxShadow: "0px 12px 32px rgba(15, 23, 42, 0.12)",
                }}
                transition={{ delay: idx * 0.08 }}
                style={{ transformPerspective: 900 }}
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
                <div className="mt-3">
                  <Sparkline values={sparklineForIndex(idx)} tone={stat.tone} />
                </div>
              </motion.div>
            ))}
          </section>
        )}

        <section className="hidden gap-4 lg:grid lg:grid-cols-3">
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
              {data.orders.length ? (
                <>
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
                            <StatusPillWithPulse status={order.status} />
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
                          <StatusPillWithPulse status={order.status} />
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
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No orders yet"
                    detail="New orders will appear here once created."
                  />
                </div>
              )}
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
              {data.categories.length ? (
                <>
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
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No categories yet"
                    detail="Create categories to organize products."
                  />
                </div>
              )}
            </div>
          </motion.div>
        </section>

        <section className="hidden lg:block">
          <motion.div
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -2, boxShadow: "0px 10px 35px rgba(15,23,42,0.1)" }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Live tracking
                </p>
                <h2 className="text-lg font-bold text-slate-900">Driver map</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    setMapStyleMode((prev) => (prev === "dark" ? "light" : "dark"))
                  }
                >
                  {mapStyleMode === "dark" ? "Light map" : "Dark map"}
                </button>
                <button
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  onClick={() => {
                    const first = Object.values(driverLocations)[0];
                    if (!first || !mapInstanceRef.current) return;
                    mapInstanceRef.current.setCenter({ lat: first.lat, lng: first.lng });
                    mapInstanceRef.current.setZoom(13);
                  }}
                >
                  Center map
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {mapsKeyMissing ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Add Google Maps API key to enable the map.
                    </div>
                  ) : mapReady ? (
                    <div ref={mapContainerRef} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Loading map...
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Driver status
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {drivers.length} drivers assigned
                  </p>
                </div>
                {driverCards.length ? (
                  driverCards.map(({ driver, status, updatedAt }) => (
                    <div
                      key={driver.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {driver.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {driver.email || "No email"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            status === "Active"
                              ? "bg-emerald-50 text-emerald-700"
                              : status === "Idle"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Last update: {updatedAt ? updatedAt.toLocaleTimeString() : "N/A"}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No driver locations"
                    detail="Assign drivers and enable tracking to see them here."
                  />
                )}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="hidden gap-4 lg:grid lg:grid-cols-3">
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
              {data.products.length ? (
                <>
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
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No products yet"
                    detail="Add products to populate this list."
                  />
                </div>
              )}
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
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Gallery</h2>
                <p className="text-sm text-slate-500">
                  Curate images for the mobile gallery tab.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                onClick={() => (window.location.href = "/gallery/new")}
              >
                Add gallery item
              </button>
              <button
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:shadow"
                onClick={() => (window.location.href = "/gallery")}
              >
                View gallery
              </button>
            </div>
          </motion.div>

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
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {data.lanes.map((lane) => {
                const labelMap: Record<string, string> = {
                  Fulfillment: "Fleet Readiness",
                  "Cleanliness QA": "Sanitation Cycle",
                  "Driver Availability": "Dispatch Reliability",
                  "Support SLA": "Customer Support Load",
                };
                const displayLabel = labelMap[lane.label] ?? lane.label;
                return (
                <div key={lane.label}>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{displayLabel}</span>
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
              );
              })}
            </div>
          </motion.div>
        </section>

        <section className="hidden gap-4 lg:grid lg:grid-cols-3">
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
              {data.alerts.length ? (
                data.alerts.map((alert, idx) => (
                  <AlertItem key={idx} title={alert.title} tone={alert.tone} />
                ))
              ) : (
                <EmptyState
                  title="No alerts right now"
                  detail="All operational areas look healthy."
                />
              )}
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
        <motion.button
          type="button"
          className="fixed bottom-5 right-5 z-40 rounded-full bg-emerald-600 px-4 py-3 text-xs font-semibold text-white shadow-lg lg:hidden"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setSidebarOpen(true)}
        >
          Quick actions
        </motion.button>
        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone?: "green" | "orange" | "red";
}) {
  if (!values.length) {
    return <div className="h-6 w-full rounded-md bg-slate-100" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .slice(-10)
    .map((value, index, arr) => {
      const x = (index / (arr.length - 1 || 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke =
    tone === "red"
      ? "#dc2626"
      : tone === "orange"
      ? "#d97706"
      : "#059669";
  return (
    <svg viewBox="0 0 100 40" className="h-6 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
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

function StatusPillWithPulse({ status }: { status: OrderStatus }) {
  const pulseStatuses = ["Processing", "Dispatched", "In transit"];
  const showPulse = pulseStatuses.includes(status);
  const dotColor =
    status === "Dispatched" || status === "In transit"
      ? "bg-blue-500"
      : "bg-amber-500";
  return (
    <div className="inline-flex items-center gap-2">
      {showPulse ? (
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`}
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`}
          />
        </span>
      ) : null}
      <StatusPill status={status} />
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        --
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
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
      whileHover={{ y: -2, rotateX: 2, rotateY: -2 }}
      style={{ transformPerspective: 800 }}
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

const lightMapStyle: any[] = [];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
];

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
