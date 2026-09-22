"use client";

import { useEffect, useRef, useState } from "react";
import DeliveryMapModal from "./DeliveryMapModal";
import type { AddressSearchResult } from "@/app/api/address/search/route";

type Props = {
  value: string;
  onChange: (concatenatedAddress: string) => void;
  error?: string;
};

export default function DeliveryAddressPicker({ value, onChange, error }: Props) {
  // Parse initial value if present
  const parseInitialValue = (addrStr: string) => {
    if (!addrStr || !addrStr.trim()) {
      return {
        street: "",
        apartment: "",
        entrance: "",
        floor: "",
        intercom: "",
        isPrivateHouse: false,
        isManualMode: false,
        manualAddress: "",
      };
    }

    const isPrivate = addrStr.includes("(приватний будинок)");
    const cleanStr = addrStr.replace(/\s*\(приватний будинок\)\s*/i, "");

    const aptMatch = cleanStr.match(/кв\.?\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
    const entMatch = cleanStr.match(/під(?:'|’)?їзд\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
    const floorMatch = cleanStr.match(/поверх\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);
    const codeMatch = cleanStr.match(/\(?(?:код|домофон):?\s*([^\)]+)\)?/i);

    // If it has structured keywords, extract street part before them
    if (aptMatch || entMatch || floorMatch || isPrivate) {
      const streetPart = cleanStr
        .split(/,\s*(?:кв\.?|під(?:'|’)?їзд|поверх|\(?код)/i)[0]
        .trim();

      return {
        street: streetPart || cleanStr,
        apartment: aptMatch ? aptMatch[1] : "",
        entrance: entMatch ? entMatch[1] : "",
        floor: floorMatch ? floorMatch[1] : "",
        intercom: codeMatch ? codeMatch[1].trim() : "",
        isPrivateHouse: isPrivate,
        isManualMode: false,
        manualAddress: "",
      };
    }

    // Default to street field directly
    return {
      street: addrStr,
      apartment: "",
      entrance: "",
      floor: "",
      intercom: "",
      isPrivateHouse: false,
      isManualMode: false,
      manualAddress: "",
    };
  };

  const [initialState] = useState(() => parseInitialValue(value));

  const [street, setStreet] = useState(initialState.street);
  const [apartment, setApartment] = useState(initialState.apartment);
  const [entrance, setEntrance] = useState(initialState.entrance);
  const [floor, setFloor] = useState(initialState.floor);
  const [intercom, setIntercom] = useState(initialState.intercom);
  const [isPrivateHouse, setIsPrivateHouse] = useState(initialState.isPrivateHouse);
  const [isManualMode, setIsManualMode] = useState(initialState.isManualMode);
  const [manualAddress, setManualAddress] = useState(initialState.manualAddress || value);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const lastSyncedRef = useRef(value);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync state if value prop changes from an external source (e.g. profile pre-filling or reset)
  useEffect(() => {
    if (value !== lastSyncedRef.current) {
      lastSyncedRef.current = value;
      const parsed = parseInitialValue(value);
      setStreet(parsed.street);
      setApartment(parsed.apartment);
      setEntrance(parsed.entrance);
      setFloor(parsed.floor);
      setIntercom(parsed.intercom);
      setIsPrivateHouse(parsed.isPrivateHouse);
      setIsManualMode(parsed.isManualMode);
      setManualAddress(parsed.manualAddress || value);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Concatenate whenever structured fields change
  const buildConcatenated = (
    st: string,
    apt: string,
    ent: string,
    fl: string,
    code: string,
    privateHouse: boolean,
    manual: boolean,
    manualText: string
  ) => {
    if (manual) {
      return manualText.trim();
    }

    const trimmedStreet = st.trim();
    if (!trimmedStreet) return "";

    if (privateHouse) {
      return `${trimmedStreet} (приватний будинок)`;
    }

    const parts: string[] = [trimmedStreet];
    if (apt.trim()) parts.push(`кв. ${apt.trim()}`);
    if (ent.trim()) parts.push(`під'їзд ${ent.trim()}`);
    if (fl.trim()) parts.push(`поверх ${fl.trim()}`);
    if (code.trim()) parts.push(`(код: ${code.trim()})`);

    return parts.join(", ");
  };

  const triggerChange = (
    nextStreet = street,
    nextApt = apartment,
    nextEnt = entrance,
    nextFloor = floor,
    nextIntercom = intercom,
    nextPrivate = isPrivateHouse,
    nextManual = isManualMode,
    nextManualText = manualAddress
  ) => {
    const result = buildConcatenated(
      nextStreet,
      nextApt,
      nextEnt,
      nextFloor,
      nextIntercom,
      nextPrivate,
      nextManual,
      nextManualText
    );
    lastSyncedRef.current = result;
    onChange(result);
  };

  // Search autocomplete on street typing
  const handleStreetChange = (text: string) => {
    setStreet(text);
    triggerChange(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/search?q=${encodeURIComponent(text)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
          setShowDropdown(Boolean(data.results && data.results.length > 0));
        }
      } catch (err) {
        console.error("Address search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleSelectSuggestion = (s: AddressSearchResult) => {
    setStreet(s.name);
    setShowDropdown(false);
    triggerChange(s.name);
  };

  const handleMapSelect = (res: { road: string; houseNumber: string; fullStreet: string }) => {
    const chosen = res.fullStreet || (res.houseNumber ? `${res.road}, ${res.houseNumber}` : res.road);
    setStreet(chosen);
    setShowDropdown(false);
    triggerChange(chosen);
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header with Map Button and Manual Switch */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <span>Адреса доставки</span>
          <span className="text-emerald-600 font-bold">*</span>
        </span>

        <div className="flex items-center gap-2">
          {!isManualMode && (
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs transition active:scale-95 shadow-xs"
            >
              <span>📍</span>
              <span>На карті</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const nextManual = !isManualMode;
              setIsManualMode(nextManual);
              if (nextManual && !manualAddress) {
                const currentFull = buildConcatenated(street, apartment, entrance, floor, intercom, isPrivateHouse, false, "");
                setManualAddress(currentFull);
                triggerChange(street, apartment, entrance, floor, intercom, isPrivateHouse, true, currentFull);
              } else {
                triggerChange(street, apartment, entrance, floor, intercom, isPrivateHouse, nextManual, manualAddress);
              }
            }}
            className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition underline underline-offset-2"
          >
            {isManualMode ? "Структурована адреса" : "Ввести вручну"}
          </button>
        </div>
      </div>

      {isManualMode ? (
        /* Manual Full-text Fallback Mode */
        <div className="space-y-2 animate-in fade-in duration-200">
          <textarea
            id="address"
            name="address"
            value={manualAddress}
            onChange={(e) => {
              const val = e.target.value;
              setManualAddress(val);
              triggerChange(street, apartment, entrance, floor, intercom, isPrivateHouse, true, val);
            }}
            placeholder="Введіть повну адресу в довільній формі (наприклад: вул. Перемоги 24, під'їзд 1, орієнтир аптека)"
            rows={3}
            className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 scroll-mt-32 ${
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
            }`}
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Використовується довільний формат. Ви можете перемкнутися назад за потреби.
          </p>
        </div>
      ) : (
        /* Structured Mode matching reference image */
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Street & House Input with Autocomplete Dropdown */}
          <div className="relative">
            <div className="relative flex items-center">
              <input
                id="address"
                name="address"
                type="text"
                value={street}
                onChange={(e) => handleStreetChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder="вулиця та номер будинку (наприклад: вул. Ціолковського 20)"
                className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 pr-10 ${
                  error && !street.trim()
                    ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
                }`}
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <span className="h-4 w-4 block animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </div>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-40 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{s.name}</span>
                        {s.houseNumber && <span className="ml-1 text-emerald-600 font-bold">№ {s.houseNumber}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">Запоріжжя</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Conditional Multi-apartment Fields */}
          {!isPrivateHouse && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Apartment */}
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Квартира <span className="text-slate-400 font-normal text-[11px]">(за наявності)</span>
                  </span>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApartment(val);
                      triggerChange(street, val, entrance, floor, intercom, isPrivateHouse, false, "");
                    }}
                    placeholder="Напр. 45"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>

              {/* Entrance */}
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Під&apos;їзд
                  </span>
                  <input
                    type="text"
                    value={entrance}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEntrance(val);
                      triggerChange(street, apartment, val, floor, intercom, isPrivateHouse, false, "");
                    }}
                    placeholder="Напр. 2"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>

              {/* Floor */}
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Поверх
                  </span>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFloor(val);
                      triggerChange(street, apartment, entrance, val, intercom, isPrivateHouse, false, "");
                    }}
                    placeholder="Напр. 5"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>

              {/* Intercom Code */}
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Код домофона
                  </span>
                  <input
                    type="text"
                    value={intercom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIntercom(val);
                      triggerChange(street, apartment, entrance, floor, val, isPrivateHouse, false, "");
                    }}
                    placeholder="Напр. 1234 або К45"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>
          )}

          {/* "Це приватний будинок" Toggle Switch */}
          <div className="pt-2 flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🏡</span>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Це приватний будинок
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Квартира, поверх та під&apos;їзд не потрібні
                </div>
              </div>
            </div>

            {/* iOS style toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isPrivateHouse}
              onClick={() => {
                const nextPrivate = !isPrivateHouse;
                setIsPrivateHouse(nextPrivate);
                triggerChange(street, apartment, entrance, floor, intercom, nextPrivate, false, "");
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPrivateHouse ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isPrivateHouse ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Error Message if any */}
      {error && (
        <span className="block text-xs font-semibold text-red-600 dark:text-red-400 animate-in fade-in duration-150">
          {error}
        </span>
      )}

      {/* Interactive Map Modal */}
      <DeliveryMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelectAddress={handleMapSelect}
      />
    </div>
  );
}
