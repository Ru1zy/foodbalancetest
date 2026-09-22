"use client";

import { useEffect, useRef, useState } from "react";
import DeliveryMapModal from "./DeliveryMapModal";
import type { AddressSearchResult } from "@/app/api/address/search/route";

type Props = {
  value: string;
  onChange: (concatenatedAddress: string) => void;
  error?: string;
};

type ParsedAddress = {
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  isPrivateHouse: boolean;
  isManualMode: boolean;
  manualAddress: string;
};

export default function DeliveryAddressPicker({ value, onChange, error }: Props) {
  // Parse initial value if present
  const parseInitialValue = (addrStr: string): ParsedAddress => {
    if (!addrStr || !addrStr.trim()) {
      return {
        street: "",
        house: "",
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
    const houseMatch = cleanStr.match(/буд\.?\s*([0-9a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]+)/i);

    // If it has structured keywords, extract street part before them
    if (aptMatch || entMatch || floorMatch || isPrivate || houseMatch) {
      let streetPart = cleanStr
        .split(/,\s*(?:буд\.?|кв\.?|під(?:'|’)?їзд|поверх|\(?код)/i)[0]
        .trim();

      let housePart = houseMatch ? houseMatch[1] : "";

      if (!housePart) {
        const commaNum = streetPart.match(/,\s*([0-9]+[a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]*)$/);
        if (commaNum) {
          housePart = commaNum[1];
          streetPart = streetPart.replace(/,\s*[0-9]+[a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]*$/, "").trim();
        }
      }

      return {
        street: streetPart || cleanStr,
        house: housePart,
        apartment: aptMatch ? aptMatch[1] : "",
        entrance: entMatch ? entMatch[1] : "",
        floor: floorMatch ? floorMatch[1] : "",
        intercom: codeMatch ? codeMatch[1].trim() : "",
        isPrivateHouse: isPrivate,
        isManualMode: false,
        manualAddress: "",
      };
    }

    // Default: check if addrStr has comma-separated number
    const commaNum = addrStr.match(/^(.*?),\s*([0-9]+[a-zA-Zа-яА-ЯіїєґІЇЄҐ/-]*)$/);
    if (commaNum) {
      return {
        street: commaNum[1].trim(),
        house: commaNum[2].trim(),
        apartment: "",
        entrance: "",
        floor: "",
        intercom: "",
        isPrivateHouse: false,
        isManualMode: false,
        manualAddress: "",
      };
    }

    return {
      street: addrStr,
      house: "",
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
  const [house, setHouse] = useState(initialState.house);
  const [apartment, setApartment] = useState(initialState.apartment);
  const [entrance, setEntrance] = useState(initialState.entrance);
  const [floor, setFloor] = useState(initialState.floor);
  const [intercom, setIntercom] = useState(initialState.intercom);
  const [isPrivateHouse, setIsPrivateHouse] = useState(initialState.isPrivateHouse);
  const [isManualMode, setIsManualMode] = useState(initialState.isManualMode);
  const [manualAddress, setManualAddress] = useState(initialState.manualAddress || value);

  const houseInputRef = useRef<HTMLInputElement | null>(null);
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
      setHouse(parsed.house);
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
    hs: string,
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
    const trimmedHouse = hs.trim();
    if (!trimmedStreet) return "";

    const housePart = trimmedHouse ? `, буд. ${trimmedHouse}` : "";

    if (privateHouse) {
      return `${trimmedStreet}${housePart} (приватний будинок)`;
    }

    const parts: string[] = [`${trimmedStreet}${housePart}`];
    if (apt.trim()) parts.push(`кв. ${apt.trim()}`);
    if (ent.trim()) parts.push(`під'їзд ${ent.trim()}`);
    if (fl.trim()) parts.push(`поверх ${fl.trim()}`);
    if (code.trim()) parts.push(`(код: ${code.trim()})`);

    return parts.join(", ");
  };

  const triggerChange = (overrides?: {
    street?: string;
    house?: string;
    apartment?: string;
    entrance?: string;
    floor?: string;
    intercom?: string;
    isPrivateHouse?: boolean;
    isManualMode?: boolean;
    manualAddress?: string;
  }) => {
    const nextStreet = overrides?.street !== undefined ? overrides.street : street;
    const nextHouse = overrides?.house !== undefined ? overrides.house : house;
    const nextApt = overrides?.apartment !== undefined ? overrides.apartment : apartment;
    const nextEnt = overrides?.entrance !== undefined ? overrides.entrance : entrance;
    const nextFloor = overrides?.floor !== undefined ? overrides.floor : floor;
    const nextIntercom = overrides?.intercom !== undefined ? overrides.intercom : intercom;
    const nextPrivate = overrides?.isPrivateHouse !== undefined ? overrides.isPrivateHouse : isPrivateHouse;
    const nextManual = overrides?.isManualMode !== undefined ? overrides.isManualMode : isManualMode;
    const nextManualText = overrides?.manualAddress !== undefined ? overrides.manualAddress : manualAddress;

    const result = buildConcatenated(
      nextStreet,
      nextHouse,
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
    triggerChange({ street: text });

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
    const chosenHouse = s.houseNumber || house || "";
    if (s.houseNumber) {
      setHouse(s.houseNumber);
    }
    triggerChange({ street: s.name, house: chosenHouse });
    if (!s.houseNumber) {
      setTimeout(() => {
        houseInputRef.current?.focus();
      }, 50);
    }
  };

  const handleMapSelect = (res: { road: string; houseNumber: string; fullStreet: string }) => {
    const chosenRoad = res.road || res.fullStreet || "";
    const chosenHouse = res.houseNumber || "";
    setStreet(chosenRoad);
    setHouse(chosenHouse);
    setShowDropdown(false);
    triggerChange({ street: chosenRoad, house: chosenHouse });
    if (!chosenHouse) {
      setTimeout(() => {
        houseInputRef.current?.focus();
      }, 50);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header with Map Button and Manual Switch */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center whitespace-nowrap shrink-0 pt-0.5">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Адреса доставки<span className="text-emerald-500 font-bold ml-1">*</span>
          </span>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {!isManualMode && (
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs transition active:scale-95 shadow-2xs whitespace-nowrap cursor-pointer"
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
                const currentFull = buildConcatenated(street, house, apartment, entrance, floor, intercom, isPrivateHouse, false, "");
                setManualAddress(currentFull);
                triggerChange({ isManualMode: true, manualAddress: currentFull });
              } else {
                triggerChange({ isManualMode: nextManual });
              }
            }}
            className="text-xs font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition underline underline-offset-2 whitespace-nowrap cursor-pointer py-0.5"
          >
            {isManualMode ? "← Структурована адреса" : "Ввести вручну"}
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
              triggerChange({ isManualMode: true, manualAddress: val });
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
          {/* Street & House Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Street Autocomplete */}
            <div className="sm:col-span-2 relative">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Вулиця <span className="text-emerald-600 font-bold">*</span>
                </span>
                <div className="relative flex items-center">
                  <input
                    id="address-street"
                    type="text"
                    value={street}
                    onChange={(e) => handleStreetChange(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowDropdown(true);
                    }}
                    placeholder="Почніть вводити вулицю..."
                    className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 pr-10 ${
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
              </label>

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

            {/* House Number (Mandatory) */}
            <div className="sm:col-span-1">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Будинок <span className="text-emerald-600 font-bold">*</span>
                </span>
                <input
                  ref={houseInputRef}
                  id="address-house"
                  type="text"
                  value={house}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHouse(val);
                    triggerChange({ house: val });
                  }}
                  placeholder="14 або 28-Б"
                  className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 ${
                    error && street.trim() && !house?.trim()
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100 ring-2 ring-red-100"
                      : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
                  }`}
                />
              </label>
            </div>
          </div>

          {/* Validation tip if street is chosen but house is empty */}
          {street.trim() && !house?.trim() && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              💡 Не забудьте вказати номер будинку для кур&apos;єра.
            </p>
          )}

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
                    maxLength={10}
                    value={apartment}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9a-zA-Zа-яА-ЯіІїЇєЄґҐ/\\-]/g, "").slice(0, 10);
                      setApartment(val);
                      triggerChange({ apartment: val });
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
                    maxLength={8}
                    value={entrance}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9a-zA-Zа-яА-ЯіІїЇєЄґҐ-]/g, "").slice(0, 8);
                      setEntrance(val);
                      triggerChange({ entrance: val });
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
                    maxLength={6}
                    value={floor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9-]/g, "").slice(0, 6);
                      setFloor(val);
                      triggerChange({ floor: val });
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
                    maxLength={25}
                    value={intercom}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 25);
                      setIntercom(val);
                      triggerChange({ intercom: val });
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
                triggerChange({ isPrivateHouse: nextPrivate });
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
