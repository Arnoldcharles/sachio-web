'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import { OrderStatus, StatusPill } from "../../page";

declare global {
  interface Window {
    google?: any;
  }
}

const statusOptions = ["processing", "dispatched", "in_transit", "delivered", "completed", "cancelled_by_admin", "waiting_admin_price", "price_set", "paid"] as const;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [priceInput, setPriceInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; label: string; email?: string; active?: boolean }[]>([]);
  const [driverId, setDriverId] = useState<string>("");
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    speed?: number | null;
    heading?: number | null;
  } | null>(null);
  const [driverLocationUpdatedAt, setDriverLocationUpdatedAt] = useState<Date | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<"light" | "dark">("light");
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [routePath, setRoutePath] = useState<any[]>([]);
  const [offRoute, setOffRoute] = useState(false);
  const [arrivalSoon, setArrivalSoon] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const mapClickListenerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [destinationDraft, setDestinationDraft] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [destinationSaving, setDestinationSaving] = useState(false);
  const [destinationToast, setDestinationToast] = useState<string | null>(null);

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
          setDriverId(data.driverId || "");
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

  useEffect(() => {
    let mounted = true;
    async function loadDrivers() {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("isDriver", "==", true)));
        if (!mounted) return;
        setDrivers(
          snap.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              label: data.name || data.fullName || data.email || docSnap.id,
              email: data.email,
              active: Boolean(data.isDriverActive),
            };
          })
        );
      } catch {
        // ignore driver load errors
      }
    }
    loadDrivers();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sachio_dashboard_theme");
    if (stored === "dark" || stored === "light") {
      setMapStyleMode(stored);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setMapStyleMode(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;
    const load = async () => {
      if (window.google?.maps) {
        if (!cancelled) setMapReady(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
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
  }, []);

  useEffect(() => {
    if (!driverId) {
      setDriverLocation(null);
      setDriverLocationUpdatedAt(null);
      return;
    }
    const locRef = doc(db, "driverLocations", driverId);
    const unsub = onSnapshot(
      locRef,
      (snap) => {
        if (!snap.exists()) {
          setDriverLocation(null);
          return;
        }
        const data = snap.data() as any;
        if (typeof data?.lat === "number" && typeof data?.lng === "number") {
          setDriverLocation({
            lat: data.lat,
            lng: data.lng,
            speed: typeof data?.speed === "number" ? data.speed : null,
            heading: typeof data?.heading === "number" ? data.heading : null,
          });
        } else {
          setDriverLocation(null);
        }
        const updatedAt = data?.updatedAt;
        if (updatedAt?.toDate) {
          setDriverLocationUpdatedAt(updatedAt.toDate());
        } else if (typeof updatedAt?.seconds === "number") {
          setDriverLocationUpdatedAt(new Date(updatedAt.seconds * 1000));
        } else if (typeof updatedAt === "number") {
          setDriverLocationUpdatedAt(new Date(updatedAt));
        } else {
          setDriverLocationUpdatedAt(null);
        }
      },
      () => {
        setDriverLocation(null);
        setDriverLocationUpdatedAt(null);
      }
    );
    return () => unsub();
  }, [driverId]);

  const destination = useMemo(() => {
    const lat =
      order?.destinationLat ??
      order?.locationLat ??
      order?.deliveryLat ??
      order?.lat ??
      null;
    const lng =
      order?.destinationLng ??
      order?.locationLng ??
      order?.deliveryLng ??
      order?.lng ??
      null;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng };
    }
    return null;
  }, [order]);

  const activeDestination = destinationDraft
    ? { lat: destinationDraft.lat, lng: destinationDraft.lng }
    : destination;

  const driverStatus = useMemo(() => {
    const driverMeta = drivers.find((driver) => driver.id === driverId);
    if (driverMeta?.active) return "Active";
    if (!driverLocationUpdatedAt) return "Offline";
    const ageMs = Date.now() - driverLocationUpdatedAt.getTime();
    if (ageMs > 5 * 60 * 1000) return "Offline";
    return "Active";
  }, [driverLocationUpdatedAt, drivers, driverId]);

  const speedKmh = useMemo(() => {
    if (driverLocation?.speed == null) return null;
    return Math.round(driverLocation.speed * 3.6);
  }, [driverLocation]);

  const headingLabel = useMemo(() => {
    if (driverLocation?.heading == null) return null;
    const heading = Math.round(driverLocation.heading);
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round(((heading % 360) / 45)) % 8;
    return `${heading}° ${dirs[idx]}`;
  }, [driverLocation]);

  const driverMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);


  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: 6.5244, lng: 3.3792 },
      zoom: 12,
      styles: mapStyleMode === "dark" ? darkMapStyle : lightMapStyle,
      disableDefaultUI: true,
      zoomControl: true,
    });
    geocoderRef.current = new window.google.maps.Geocoder();
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#16A34A",
        strokeWeight: 4,
      },
      map: mapInstanceRef.current,
    });
  }, [mapReady, mapStyleMode]);

  useEffect(() => {
    if (!mapReady) return;
    if (!addressInputRef.current) return;
    if (!window.google?.maps?.places) return;
    if (autocompleteRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      fields: ["geometry", "formatted_address"],
      types: ["geocode"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place?.geometry?.location;
      if (!location) return;
      const address =
        place?.formatted_address || addressInputRef.current?.value || "Destination";
      setDestinationDraft({
        address,
        lat: location.lat(),
        lng: location.lng(),
      });
    });
    autocompleteRef.current = autocomplete;
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;
    if (mapClickListenerRef.current) {
      mapClickListenerRef.current.remove();
    }
    mapClickListenerRef.current = map.addListener("click", (event: any) => {
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (typeof lat !== "number" || typeof lng !== "number") return;
      if (geocoderRef.current) {
        geocoderRef.current.geocode(
          { location: { lat, lng } },
          (results: any, status: string) => {
            const address =
              status === "OK" && results?.[0]?.formatted_address
                ? results[0].formatted_address
                : "Pinned destination";
            setDestinationDraft({ address, lat, lng });
          }
        );
      } else {
        setDestinationDraft({ address: "Pinned destination", lat, lng });
      }
    });
    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({
      styles: mapStyleMode === "dark" ? darkMapStyle : lightMapStyle,
    });
  }, [mapStyleMode]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !driverLocation) return;
    if (!window.google?.maps) return;
    const map = mapInstanceRef.current;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        map,
        title: order?.driverName || "Driver",
      });
    }
    driverMarkerRef.current.setPosition({
      lat: driverLocation.lat,
      lng: driverLocation.lng,
    });
    if (activeDestination) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new window.google.maps.Marker({
          map,
          title: "Destination",
          draggable: true,
        });
        destinationMarkerRef.current.addListener("dragend", (event: any) => {
          const lat = event?.latLng?.lat?.();
          const lng = event?.latLng?.lng?.();
          if (typeof lat !== "number" || typeof lng !== "number") return;
          const applyAndSave = (address: string) => {
            setDestinationDraft({ address, lat, lng });
            setTimeout(() => saveDestination(), 0);
          };
          if (geocoderRef.current) {
            geocoderRef.current.geocode(
              { location: { lat, lng } },
              (results: any, status: string) => {
                const address =
                  status === "OK" && results?.[0]?.formatted_address
                    ? results[0].formatted_address
                    : "Pinned destination";
                applyAndSave(address);
              }
            );
          } else {
            applyAndSave("Pinned destination");
          }
        });
      }
      destinationMarkerRef.current.setPosition({
        lat: activeDestination.lat,
        lng: activeDestination.lng,
      });
      const service = new window.google.maps.DirectionsService();
      service.route(
        {
          origin: { lat: driverLocation.lat, lng: driverLocation.lng },
          destination: { lat: activeDestination.lat, lng: activeDestination.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          if (status === "OK" && result) {
            directionsRendererRef.current?.setDirections(result);
            const leg = result.routes?.[0]?.legs?.[0];
            setRoutePath(result.routes?.[0]?.overview_path ?? []);
            if (leg?.distance?.text && leg?.duration?.text) {
              setRouteInfo({ distanceText: leg.distance.text, durationText: leg.duration.text });
            }
          } else {
            directionsRendererRef.current?.setDirections({ routes: [] });
            setRouteInfo(null);
            setRoutePath([]);
          }
        }
      );
    } else {
      directionsRendererRef.current?.setDirections({ routes: [] });
      setRouteInfo(null);
    }
  }, [mapReady, driverLocation, activeDestination, order?.driverName]);

  useEffect(() => {
    if (!mapReady || !window.google?.maps?.geometry) return;
    if (!driverLocation || !activeDestination) {
      setArrivalSoon(false);
      return;
    }
    const distance =
      window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng),
        new window.google.maps.LatLng(activeDestination.lat, activeDestination.lng)
      );
    setArrivalSoon(distance <= 200);
  }, [mapReady, driverLocation, activeDestination]);

  useEffect(() => {
    if (!mapReady || !window.google?.maps?.geometry) return;
    if (!driverLocation || !routePath.length) {
      setOffRoute(false);
      return;
    }
    const driverPoint = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    let minDistance = Number.POSITIVE_INFINITY;
    routePath.forEach((point) => {
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(driverPoint, point);
      if (distance < minDistance) minDistance = distance;
    });
    setOffRoute(minDistance > 200);
  }, [mapReady, driverLocation, routePath]);

  const applyTypedAddress = () => {
    if (!geocoderRef.current || !addressInputRef.current?.value) return;
    const address = addressInputRef.current.value;
    geocoderRef.current.geocode({ address }, (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        alert("Could not locate that address. Try dropping a pin on the map.");
        return;
      }
      const location = results[0].geometry?.location;
      if (!location) return;
      setDestinationDraft({
        address: results[0].formatted_address || address,
        lat: location.lat(),
        lng: location.lng(),
      });
    });
  };

  const saveDestination = async () => {
    if (!id) return;
    if (!destinationDraft) {
      applyTypedAddress();
      return;
    }
    setDestinationSaving(true);
    try {
      await updateDoc(doc(db, "orders", id), {
        destinationLat: destinationDraft.lat,
        destinationLng: destinationDraft.lng,
        destinationAddress: destinationDraft.address,
        destinationSetAt: serverTimestamp(),
      });
      setOrder((prev: any) => ({
        ...prev,
        destinationLat: destinationDraft.lat,
        destinationLng: destinationDraft.lng,
        destinationAddress: destinationDraft.address,
      }));
      setDestinationDraft(null);
      if (addressInputRef.current) {
        addressInputRef.current.value = "";
      }
      setDestinationToast("Destination saved");
      setTimeout(() => setDestinationToast(null), 2200);
    } catch {
      alert("Could not save destination.");
    } finally {
      setDestinationSaving(false);
    }
  };

  const resetDestination = async () => {
    if (!id) return;
    setDestinationSaving(true);
    try {
      await updateDoc(doc(db, "orders", id), {
        destinationLat: null,
        destinationLng: null,
        destinationAddress: null,
      });
      setOrder((prev: any) => ({
        ...prev,
        destinationLat: null,
        destinationLng: null,
        destinationAddress: null,
      }));
      setDestinationDraft(null);
      if (addressInputRef.current) {
        addressInputRef.current.value = "";
      }
    } catch {
      alert("Could not reset destination.");
    } finally {
      setDestinationSaving(false);
    }
  };

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

  const assignDriver = async (nextId: string) => {
    if (!id) return;
    setSaving(true);
    try {
      const selected = drivers.find((d) => d.id === nextId);
      await updateDoc(doc(db, "orders", id), {
        driverId: nextId || null,
        driverName: selected?.label || null,
        driverEmail: selected?.email || null,
      });
      setDriverId(nextId);
      setOrder((prev: any) => ({
        ...prev,
        driverId: nextId || null,
        driverName: selected?.label || null,
        driverEmail: selected?.email || null,
      }));
    } catch {
      alert("Could not assign driver");
    } finally {
      setSaving(false);
    }
  };

  const isDriverLocationStale =
    driverLocationUpdatedAt ? Date.now() - driverLocationUpdatedAt.getTime() > 5 * 60 * 1000 : false;

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

              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver assignment</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <select
                    value={driverId}
                    onChange={(e) => assignDriver(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={saving}
                  >
                    <option value="">No driver assigned</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.label}
                      </option>
                    ))}
                  </select>
                  {order?.driverName ? (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {order.driverName}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      driverStatus === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {driverStatus}
                  </span>
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      setMapStyleMode((prev) => (prev === "dark" ? "light" : "dark"))
                    }
                    type="button"
                  >
                    {mapStyleMode === "dark" ? "Light map" : "Dark map"}
                  </button>
                    <button
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={() => setShowResetConfirm(true)}
                      type="button"
                      disabled={destinationSaving || (!order?.destinationLat && !order?.destinationLng && !destinationDraft)}
                    >
                      Reset destination
                    </button>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      ref={addressInputRef}
                      className="w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      placeholder="Type destination address"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                    />
                    <button
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      onClick={applyTypedAddress}
                      disabled={!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || destinationSaving}
                      type="button"
                    >
                      Use typed address
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                      onClick={saveDestination}
                      disabled={!destinationDraft || destinationSaving}
                      type="button"
                    >
                      {destinationSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                      ? "Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address search."
                      : "Type an address and click Save, or tap the map to drop a pin."}
                  </p>
                  {destinationDraft ? (
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Selected: {destinationDraft.address}
                    </div>
                  ) : order?.destinationAddress ? (
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Current: {order.destinationAddress}
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Drivers share live location from the mobile app once marked as a driver.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    Last update:{" "}
                    {driverLocationUpdatedAt ? driverLocationUpdatedAt.toLocaleString() : "Not available"}
                  </span>
                  {isDriverLocationStale ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      Location stale
                    </span>
                  ) : null}
                  {speedKmh != null ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {speedKmh} km/h
                    </span>
                  ) : null}
                  {headingLabel ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {headingLabel}
                    </span>
                  ) : null}
                  {arrivalSoon ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Arriving soon
                    </span>
                  ) : null}
                  {offRoute ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      Off route
                    </span>
                  ) : null}
                  {routeInfo ? (
                    <>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {routeInfo.distanceText}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        ETA {routeInfo.durationText}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                    <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                      Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable the live map.
                    </div>
                  ) : driverLocation ? (
                    mapReady ? (
                      <div className="h-[260px] w-full" ref={mapContainerRef} />
                    ) : (
                      <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                        Loading map...
                      </div>
                    )
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                      {driverId ? "Waiting for driver location..." : "Assign a driver to see live tracking."}
                    </div>
                  )}
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
          {showResetConfirm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">Reset destination?</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      This clears the destination and removes the current route from the map.
                    </p>
                    <div className="mt-5 flex justify-end gap-3">
                      <button
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowResetConfirm(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        onClick={async () => {
                          await resetDestination();
                          setShowResetConfirm(false);
                        }}
                        disabled={destinationSaving}
                        type="button"
                      >
                        {destinationSaving ? "Resetting..." : "Reset"}
                      </button>
                    </div>
                  </div>
            </div>
          ) : null}
          {destinationToast ? (
            <div className="fixed bottom-6 right-6 z-50 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
              {destinationToast}
            </div>
          ) : null}

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
