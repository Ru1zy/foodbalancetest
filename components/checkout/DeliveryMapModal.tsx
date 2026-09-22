"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (result: { road: string; houseNumber: string; fullStreet: string }) => void;
};

// Zaporizhzhia default center
const ZAPORIZHZHIA_COORDS: [number, number] = [47.8388, 35.1396];

// Strict delivery bounds for Zaporizhzhia city limits (strictly excluding Kushuhum lat ~47.71 and Balabyne lat ~47.74)
const ZAPORIZHZHIA_BOUNDS_SW: [number, number] = [47.765, 34.980];
const ZAPORIZHZHIA_BOUNDS_NE: [number, number] = [47.935, 35.315];

// Visual delivery zone polygon covering the 7 districts of Zaporizhzhia
const ZAPORIZHZHIA_DELIVERY_POLYGON: [number, number][] = [
  [47.932, 35.065], // Borodynskyi north
  [47.936, 35.120], // Osypenkivskyi north
  [47.915, 35.185], // Pavlo-Kichkas north
  [47.885, 35.240], // Zavodskyi / Motor Sich
  [47.845, 35.285], // Shevchenkivskyi east
  [47.800, 35.265], // Kosmichnyi east
  [47.768, 35.215], // Pivdennyi / Pisky south-east
  [47.765, 35.175], // Pivdennyi south edge (strict boundary above Balabyne)
  [47.768, 35.140], // Lower Khortytsia / river boundary
  [47.785, 35.035], // Khortytskyi district south (Baburka)
  [47.820, 35.005], // Khortytskyi district west
  [47.865, 35.015], // Verkhnya Khortytsia west
  [47.900, 35.035], // Dniprovskyi north-west
  [47.932, 35.065], // Close loop
];

function isWithinZaporizhzhia(lat: number, lng: number): boolean {
  return (
    lat >= ZAPORIZHZHIA_BOUNDS_SW[0] &&
    lat <= ZAPORIZHZHIA_BOUNDS_NE[0] &&
    lng >= ZAPORIZHZHIA_BOUNDS_SW[1] &&
    lng <= ZAPORIZHZHIA_BOUNDS_NE[1]
  );
}

export default function DeliveryMapModal({ isOpen, onClose, onSelectAddress }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [isOutOfZone, setIsOutOfZone] = useState(false);
  const [addressData, setAddressData] = useState<{
    road: string;
    houseNumber: string;
    fullStreet: string;
    quarter?: string;
  } | null>(null);

  // Initialize and clean up Leaflet map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = (await import("leaflet")).default;

      // Fix missing Leaflet marker icon paths in webpack/next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapContainerRef.current || !isMounted) return;

      if (!mapInstanceRef.current) {
        const bounds = L.latLngBounds(ZAPORIZHZHIA_BOUNDS_SW, ZAPORIZHZHIA_BOUNDS_NE);
        const map = L.map(mapContainerRef.current, {
          center: ZAPORIZHZHIA_COORDS,
          zoom: 14,
          minZoom: 12,
          maxZoom: 19,
          maxBounds: bounds,
          maxBoundsViscosity: 1.0,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Visual delivery boundary frame
        L.polygon(ZAPORIZHZHIA_DELIVERY_POLYGON, {
          color: "#10b981",
          weight: 2.5,
          dashArray: "6, 6",
          fillColor: "#10b981",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(map);

        const marker = L.marker(ZAPORIZHZHIA_COORDS, {
          draggable: true,
        }).addTo(map);

        // Fetch address for coordinates
        const updateAddressForCoords = async (lat: number, lon: number) => {
          if (!isWithinZaporizhzhia(lat, lon)) {
            setIsOutOfZone(true);
            setAddressData(null);
            return;
          }
          setIsOutOfZone(false);
          setLoading(true);
          try {
            const res = await fetch(`/api/address/reverse?lat=${lat}&lon=${lon}`);
            if (res.ok) {
              const data = await res.json();
              if (data.outOfZone) {
                setIsOutOfZone(true);
                setAddressData(null);
                return;
              }
              if (isMounted) {
                setAddressData({
                  road: data.road || "",
                  houseNumber: data.houseNumber || "",
                  fullStreet: data.fullStreet || "Вулиця без назви",
                  quarter: data.quarter || "",
                });
              }
            }
          } catch (err) {
            console.error("Reverse geocoding error:", err);
          } finally {
            if (isMounted) setLoading(false);
          }
        };

        // Marker drag end
        marker.on("dragend", (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          updateAddressForCoords(lat, lng);
        });

        // Click on map to move marker
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          updateAddressForCoords(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        // Trigger initial address lookup
        updateAddressForCoords(ZAPORIZHZHIA_COORDS[0], ZAPORIZHZHIA_COORDS[1]);

        // Fix map tile rendering after modal transition
        setTimeout(() => {
          map.invalidateSize();
        }, 200);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current || !markerRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!isWithinZaporizhzhia(latitude, longitude)) {
          setIsOutOfZone(true);
          setAddressData(null);
          return;
        }
        mapInstanceRef.current.setView([latitude, longitude], 16);
        markerRef.current.setLatLng([latitude, longitude]);
        setIsOutOfZone(false);
        // Trigger reverse geocoding
        setLoading(true);
        fetch(`/api/address/reverse?lat=${latitude}&lon=${longitude}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.outOfZone) {
              setIsOutOfZone(true);
              setAddressData(null);
              return;
            }
            setAddressData({
              road: data.road || "",
              houseNumber: data.houseNumber || "",
              fullStreet: data.fullStreet || "Точка на карті",
              quarter: data.quarter || "",
            });
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      },
      (err) => {
        console.warn("Geolocation denied or failed:", err);
      },
      { timeout: 7000 }
    );
  };

  const handleConfirm = () => {
    if (addressData) {
      onSelectAddress({
        road: addressData.road,
        houseNumber: addressData.houseNumber,
        fullStreet: addressData.fullStreet,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[85vh] max-h-[680px]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📍</span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                Вкажіть адресу на карті Запоріжжя
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Перетягніть маркер або торкніться потрібного будинку
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Map Canvas Area */}
        <div className="relative flex-1 w-full bg-slate-100 dark:bg-slate-950">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Delivery Zone Badge / Frame Indicator */}
          <div className="absolute top-3 left-14 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-emerald-500/40 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 pointer-events-none">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20" />
            <span>Зона доставки: м. Запоріжжя</span>
          </div>

          {/* Quick Locate Me Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            className="absolute top-3 right-3 z-[400] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Знайти мене"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Моє розташування</span>
          </button>
        </div>

        {/* Modal Bottom Card */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1 w-full">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Визначена адреса
            </span>
            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
              {loading ? (
                <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  Визначаємо адресу...
                </span>
              ) : isOutOfZone ? (
                <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                  <span>⚠️</span>
                  <span>Поза зоною доставки (тільки м. Запоріжжя)</span>
                </span>
              ) : addressData?.fullStreet ? (
                addressData.fullStreet
              ) : (
                "Виберіть точку на карті"
              )}
            </div>
            {!isOutOfZone && addressData?.quarter && (
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {addressData.quarter}, Запоріжжя
              </div>
            )}
            {isOutOfZone && (
              <div className="text-xs font-medium text-red-500 dark:text-red-400 mt-0.5">
                Кушугум, Балабине та передмістя поза зоною доставки. Оберіть точку в межах зеленої рамки м. Запоріжжя.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="button"
              disabled={loading || isOutOfZone || !addressData?.fullStreet}
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              Підтвердити адресу
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
