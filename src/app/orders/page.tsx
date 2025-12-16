'use client';

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";
import { StatusPill, OrderStatus } from "../page";

type OrderRow = {
  id: string;
  item: string;
  customer: string;
  type: string;
  price: number | null;
   status: OrderStatus | string;
  paymentStatus?: string;
  createdAt?: Date;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (!mounted) return;
        const list: OrderRow[] = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            item: data.productTitle ?? data.productId ?? doc.id,
            customer: data.customerName ?? "Unknown",
            type: data.type === "rent" ? "Rent" : "Buy",
            price: data.amount != null ? Number(data.amount) : data.price != null ? Number(data.price) : null,
            status: data.status ?? "Processing",
            paymentStatus: data.paymentStatus ?? data.status,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
          };
        });
        setOrders(list);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async (orderId: string) => {
    const ok = window.confirm("Delete this order?");
    if (!ok) return;
    setDeletingId(orderId);
    try {
      await deleteDoc(doc(db, "orders", orderId));
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      alert("Could not delete order");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Orders</p>
            <h1 className="text-2xl font-black text-slate-900">All Orders</h1>
            <p className="text-sm text-slate-500">Manage customer purchases and rentals.</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:shadow"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{order.id}</td>
                    <td className="px-4 py-3 text-slate-700">{order.item}</td>
                    <td className="px-4 py-3 text-slate-700">{order.customer}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{order.type}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {order.type === "Rent" && order.price == null
                        ? "Waiting price"
                        : `ƒ,İ${Number(order.price ?? 0).toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={order.status as OrderStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {order.type !== "Rent" ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Paid</span>
                      ) : String(order.paymentStatus || order.status || "")
                          .toLowerCase()
                          .includes("paid") ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Paid</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          View
                        </Link>
                        <button
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => handleDelete(order.id)}
                          disabled={deletingId === order.id}
                        >
                          {deletingId === order.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
