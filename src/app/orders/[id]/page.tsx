'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import { OrderStatus, StatusPill } from "../../page";

const statusOptions = ["processing", "dispatched", "in_transit", "delivered", "completed", "cancelled_by_admin", "waiting_admin_price", "price_set", "paid"] as const;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [priceInput, setPriceInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          setOrder(data);
          setStatus(data.status || "processing");
          setPriceInput(data.amount != null ? String(data.amount) : data.price != null ? String(data.price) : "");
        } else {
          setError("Order not found.");
        }
      } catch (err) {
        console.warn(err);
        setError("Failed to load order.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const canEditStatus =
    order &&
    (order.type !== "rent" ||
      String(order.status || "").toLowerCase().includes("paid") ||
      String(order.paymentStatus || "").toLowerCase().includes("paid"));

  const updateStatus = async () => {
    if (!id) return;
    if (!canEditStatus) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", id), { status });
      setOrder((prev: any) => ({ ...prev, status }));
    } catch (err) {
      alert("Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const setPrice = async () => {
    if (!id) return;
    const amount = Number(priceInput);
    if (Number.isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", id), {
        amount,
        price: amount,
        status: "price_set",
        paymentStatus: "awaiting_payment",
        priceSetAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      });
      setOrder((prev: any) => ({
        ...prev,
        amount,
        price: amount,
        status: "price_set",
        paymentStatus: "awaiting_payment",
        priceSetAt: { seconds: Math.floor(Date.now() / 1000) },
        expiresAt: { seconds: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) },
      }));
    } catch (err) {
      alert("Could not set price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Order Details</p>
            <h1 className="text-2xl font-black text-slate-900">{id}</h1>
            <p className="text-sm text-slate-500">Review activity and update status.</p>
          </div>
          <Link href="/orders" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow">
            Back to orders
          </Link>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !order ? (
            <p className="text-sm text-slate-500">Loading order…</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
                <p className="text-lg font-bold text-slate-900">{order.customerName || "Unknown"}</p>
                <p className="text-sm text-slate-600">{order.customerAddress || "No address"}</p>
                {order.customerPhone ? <p className="text-sm text-slate-600">{order.customerPhone}</p> : null}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Info</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Item</p>
                    <p className="text-base font-bold text-slate-900">{order.productTitle || order.productId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Type</p>
                    <p className="text-base font-bold text-slate-900">{order.type === "rent" ? "Rental" : "Purchase"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Total</p>
                    <p className="text-base font-bold text-slate-900">
                      {order.type === "rent" && order.amount == null
                        ? "Waiting price"
                        : `ƒ,İ${Number(order.amount ?? order.price ?? 0).toLocaleString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Payment</p>
                    <p className="text-base font-bold text-slate-900">
                      {order.type !== "rent"
                        ? "Paid"
                        : String(order.paymentStatus || order.status || "").toLowerCase().includes("paid")
                        ? "Paid"
                        : "Unpaid"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Phone</p>
                    <p className="text-base font-bold text-slate-900">
                      {order.customerPhone || order.phone || "Not provided"}
                    </p>
                  </div>
                  {order.customerEmail ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Email</p>
                      <p className="text-base font-bold text-slate-900">{order.customerEmail}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Status</p>
                    <StatusPill status={(order.status || "processing") as OrderStatus} />
                  </div>
                  {order.toiletsRequired ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Toilets required</p>
                      <p className="text-base font-bold text-slate-900">{order.toiletsRequired}</p>
                    </div>
                  ) : null}
                  {order.productType ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Product type</p>
                      <p className="text-base font-bold text-slate-900">
                        {Array.isArray(order.productType) ? order.productType.join(", ") : order.productType}
                      </p>
                    </div>
                  ) : null}
                  {order.rentalType ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Rental type</p>
                      <p className="text-base font-bold text-slate-900">{order.rentalType}</p>
                    </div>
                  ) : null}
                  {order.duration ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Duration (days)</p>
                      <p className="text-base font-bold text-slate-900">{order.duration}</p>
                    </div>
                  ) : null}
                  {order.rentalStartDate ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Rental dates</p>
                      <p className="text-base font-bold text-slate-900">
                        {order.rentalStartDate} – {order.rentalEndDate || "N/A"}
                      </p>
                    </div>
                  ) : null}
                  {order.location ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Location</p>
                      <p className="text-base font-bold text-slate-900">{order.location}</p>
                    </div>
                  ) : null}
                  {order.state ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">State</p>
                      <p className="text-base font-bold text-slate-900">{order.state}</p>
                    </div>
                  ) : null}
                  {order.guestCount ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Guest count</p>
                      <p className="text-base font-bold text-slate-900">{order.guestCount}</p>
                    </div>
                  ) : null}
                  {order.weddingType ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Event type</p>
                      <p className="text-base font-bold text-slate-900">{order.weddingType}</p>
                    </div>
                  ) : null}
                  {order.referral ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Referral</p>
                      <p className="text-base font-bold text-slate-900">{order.referral}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {canEditStatus ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update Status</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={updateStatus}
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <p className="text-sm text-slate-600">Status updates are applied automatically when price is set or payment completes.</p>
                </div>
              )}

              {order?.type === "rent" && !String(order.paymentStatus || order.status || "").toLowerCase().includes("paid") ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Set Price</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <input
                      type="number"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                      placeholder="Enter amount"
                    />
                    <button
                      onClick={setPrice}
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Set price"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Status will move to price_set and await payment.</p>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="text-sm text-slate-600">{order.note || "—"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
