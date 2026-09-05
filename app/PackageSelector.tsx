"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import type { PackageType } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";

type Tariff = {
  id: string;
  name: string;
  title: string;
  kcal: string;
  price: string;
  basePrice: number;
  previewImageUrl: string | null;
  imageUrl: string | null;
};

type PromoItem = {
  key: string;
  url: string;
};

type Props = {
  tariffs: Tariff[];
  onSushkaViewChange?: (isOpen: boolean) => void;
  promoMaterials?: PromoItem[];
};

// Information slides for the Sushka intermediate presentation
const SUSHKA_INFO_SLIDES = [
  {
    id: "for-whom",
    badge: "Цільова аудиторія",
    shortBadge: "Для кого",
    title: "Для кого Сушка «Light»?",
    image: "/images/sushka/for-whom.jpg",
    summary: "Спеціальна білкова програма для швидкого спалювання жиру та виразного рельєфу.",
    bullets: [
      "Для тих, хто хоче скинути останні 2–5 кг",
      "Для тих, у кого настав застій у вазі («плато»)",
      "Для спортсменів перед змаганнями чи зйомками",
      "Для швидкого та помітного старту схуднення",
    ],
  },
  {
    id: "duration",
    badge: "Терміни курсу",
    shortBadge: "Терміни",
    title: "Як довго можна бути на сушці?",
    image: "/images/sushka/duration.jpg",
    summary: "Оптимальна тривалість без шкоди для здоров'я та уповільнення метаболізму.",
    bullets: [
      "Рекомендована тривалість: від 7 до 14 днів",
      "Максимальний термін курсу: до 21 дня",
      "Плавний вихід: перехід на тарифи Balance або Active",
      "Сприяє надійному збереженню досягнутого результату",
    ],
  },
  {
    id: "tariffs-info",
    badge: "Особливості раціону",
    shortBadge: "Про раціон",
    title: "Як влаштована програма?",
    image: "/images/sushka/tariffs-info.jpg",
    summary: "Максимум чистого білка та мінімум простих вуглеводів у кожній страві.",
    bullets: [
      "2 варіанти на вибір: Сушка XS (3 прийоми) та S (4 прийоми)",
      "Меню розроблене шеф-кухарем для максимального протеїну",
      "Мінімум швидких вуглеводів та шкідливих жирів",
      "Меню фіксоване — щодня шеф готує свіжі корисні страви",
    ],
  },
];

// Official flyers and metadata for standard ration packages
const RATION_FLYERS: Record<string, { flyer: string; mealsCount: string; minPriceDay: string }> = {
  Slim: {
    flyer: "/images/rations/slim-prices.jpg",
    mealsCount: "3 прийоми їжі (без перекусів)",
    minPriceDay: "від 519 ₴/день",
  },
  Balance: {
    flyer: "/images/rations/balance-prices.jpg",
    mealsCount: "4 прийоми їжі (з перекусом)",
    minPriceDay: "від 570 ₴/день",
  },
  Active: {
    flyer: "/images/rations/active-prices.jpg",
    mealsCount: "4 прийоми їжі (збільшені порції)",
    minPriceDay: "від 638 ₴/день",
  },
  Sport: {
    flyer: "/images/rations/sport-prices.jpg",
    mealsCount: "5 прийомів їжі (2 перекуси, збільшені порції)",
    minPriceDay: "від 723 ₴/день",
  },
};

export default function PackageSelector({ tariffs, onSushkaViewChange, promoMaterials }: Props) {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectWizardPackage = useOrderStore((s) => s.selectWizardPackage);
  const [showSushkaOptions, setShowSushkaOptions] = useState(false);

  const promoMap = useMemo(() => {
    const map = new Map<string, string>();
    promoMaterials?.forEach((p) => map.set(p.key, p.url));
    return map;
  }, [promoMaterials]);

  const overviewFlyer = promoMap.get("promo_programs_overview") || "/images/rations/programs-overview.jpg";
  const extraCaloriesFlyer = promoMap.get("promo_extra_calories") || "/images/rations/extra-calories.jpg";
  const forWhomSlide = promoMap.get("sushka_slide_for_whom") || "/images/sushka/for-whom.jpg";
  const durationSlide = promoMap.get("sushka_slide_duration") || "/images/sushka/duration.jpg";
  const tariffsInfoSlide = promoMap.get("sushka_slide_tariffs_info") || "/images/sushka/tariffs-info.jpg";

  const sushkaSlides = useMemo(() => [
    { ...SUSHKA_INFO_SLIDES[0], image: forWhomSlide },
    { ...SUSHKA_INFO_SLIDES[1], image: durationSlide },
    { ...SUSHKA_INFO_SLIDES[2], image: tariffsInfoSlide },
  ], [forWhomSlide, durationSlide, tariffsInfoSlide]);
  
  // Sushka presentation states
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(0);

  // Sorting and reconstruction logic
  const { sortedMainItems, sushkaOptions } = useMemo(() => {
    const standards = tariffs.filter(t => ["Slim", "Balance", "Active", "Sport"].includes(t.name));
    const sushkas = tariffs.filter(t => t.name.includes("Sushka"));
    const indivs = tariffs.filter(t => t.name.includes("Indiv"));
    
    // 1. Sort standard packages by basePrice
    standards.sort((a, b) => a.basePrice - b.basePrice);

    // Sort Sushka packages (XS first, S second)
    sushkas.sort((a, b) => a.basePrice - b.basePrice);

    // 2. Reconstruct the array
    const result: (Tariff | { type: "sushka-folder" })[] = [...standards];
    
    // Insert "Sushka" at exact index 4 (5th position)
    if (sushkas.length > 0) {
      result.splice(4, 0, { type: "sushka-folder" });
    }
    
    // Insert "Indiv" at exact index 5 (6th position)
    if (indivs.length > 0) {
      result.splice(5, 0, ...indivs);
    }

    return { 
      sortedMainItems: result, 
      sushkaOptions: sushkas 
    };
  }, [tariffs]);

  const sushkaPriceRange = useMemo(() => {
    if (sushkaOptions.length === 0) return null;
    const prices = sushkaOptions.map(o => o.basePrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${min} ₴` : `${min}–${max} ₴`;
  }, [sushkaOptions]);

  const openSushka = () => {
    setShowSushkaOptions(true);
    onSushkaViewChange?.(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeSushka = () => {
    setShowSushkaOptions(false);
    onSushkaViewChange?.(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectPackage = (pkg: Tariff) => {
    selectWizardPackage(pkg.name as PackageType);
    setShowSushkaOptions(false);
    onSushkaViewChange?.(false);
  };

  const openLightbox = (imgUrl: string, title?: string) => {
    setLightboxImage(imgUrl);
    setLightboxTitle(title || null);
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const resetZoom = () => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setPan({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const now = Date.now();
    if (now - lastTouchTimeRef.current < 300) {
      if (zoomScale > 1) {
        resetZoom();
      } else {
        setZoomScale(2);
      }
    }
    lastTouchTimeRef.current = now;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setPan((prev) => ({
      x: e.shiftKey ? prev.x - e.deltaY : prev.x,
      y: prev.y - e.deltaY,
    }));
  };

  const renderLightboxModal = () => {
    if (!lightboxImage) return null;
    return (
      <div
        className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/90 p-4 select-none"
        onClick={() => setLightboxImage(null)}
      >
        {lightboxTitle && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 text-white font-bold text-xs sm:text-base bg-black/60 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/10 max-w-[65%] sm:max-w-[80%] truncate shadow-lg">
            {lightboxTitle}
          </div>
        )}

        {/* Hint when zoomed */}
        {zoomScale > 1 && (
          <div className="absolute top-6 right-20 z-10 hidden sm:flex items-center gap-1.5 text-xs text-white/80 bg-black/50 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10">
            <span>🖐️</span> Перетягуйте мишкою або скрольте колесиком
          </div>
        )}

        <div
          className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <img
            src={lightboxImage}
            alt={lightboxTitle || "Flyer"}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center center",
              cursor: zoomScale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
              maxHeight: "88vh",
              maxWidth: "92vw",
            }}
            draggable={false}
            className="object-contain select-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => {
              if (zoomScale > 1) {
                resetZoom();
              } else {
                setZoomScale(2);
              }
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div 
          className="absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 bg-black/75 backdrop-blur-md rounded-full px-3.5 py-1.5 sm:px-6 sm:py-2.5 border border-white/20 shadow-2xl z-30 max-w-[95vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setZoomScale(prev => {
                const next = Math.max(1, +(prev - 0.5).toFixed(1));
                if (next === 1) setPan({ x: 0, y: 0 });
                return next;
              });
            }}
            disabled={zoomScale <= 1}
            className="text-white hover:text-emerald-400 p-1.5 transition-colors disabled:opacity-30 disabled:hover:text-white"
            title="Віддалити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          
          <button
            type="button"
            onClick={resetZoom}
            className="text-white hover:text-emerald-400 font-mono text-xs sm:text-sm px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-center min-w-[54px]"
            title="Натисніть для скидання до 100%"
          >
            {Math.round(zoomScale * 100)}%
          </button>

          <button
            type="button"
            onClick={() => {
              setZoomScale(prev => Math.min(3, +(prev + 0.5).toFixed(1)));
            }}
            disabled={zoomScale >= 3}
            className="text-white hover:text-emerald-400 p-1.5 transition-colors disabled:opacity-30 disabled:hover:text-white"
            title="Наблизити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>

          {zoomScale > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="ml-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/50"
              title="Скинути зум і позицію"
            >
              Скинути
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-black/60 sm:bg-white/10 text-white text-2xl sm:text-3xl hover:bg-white/25 active:scale-95 transition-all z-30 border border-white/20 backdrop-blur-md"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxImage(null);
          }}
          title="Закрити"
        >
          &times;
        </button>
      </div>
    );
  };

  // Intermediate screen for Sushka Light
  if (showSushkaOptions) {
    const currentSlide = sushkaSlides[activeSlideIndex];
    const xsOption = sushkaOptions.find(o => o.name === "Sushka XS" || o.name.toLowerCase().endsWith("xs") || o.title.toLowerCase().endsWith("xs")) || sushkaOptions[0];
    const sOption = sushkaOptions.find(o => o.name === "Sushka S" || (o.name.toLowerCase().endsWith("s") && !o.name.toLowerCase().endsWith("xs")) || (o.title.toLowerCase().endsWith("s") && !o.title.toLowerCase().endsWith("xs"))) || sushkaOptions[1];

    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pt-2 pb-12">
        {/* Top Back & Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <button
            type="button"
            onClick={closeSushka}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shadow-sm"
          >
            ← Повернутися до всіх тарифів
          </button>
          
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
              🔥 Експрес-програма
            </span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/50 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              🥩 Високий вміст білка
            </span>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700/50 px-3 py-1 text-xs font-bold text-blue-800 dark:text-blue-300">
              🎯 2 варіанти: XS та S
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            Програма «Сушка Light»
          </h2>
          <p className="max-w-2xl text-sm sm:text-base text-gray-600 dark:text-slate-400">
            Спеціалізований раціон для швидкого спалювання підшкірного жиру та збереження рельєфних м&apos;язів. Ознайомтеся з деталями програми перед замовленням:
          </p>
        </div>

        {/* Presentation Carousel / Stories */}
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          {/* Slide Category Tabs */}
          <div className="grid grid-cols-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-950/50 p-2 gap-2 text-center">
            {sushkaSlides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={`rounded-2xl py-2.5 px-2 sm:px-3 text-xs sm:text-sm font-bold transition-all duration-200 ${
                  activeSlideIndex === idx
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                }`}
              >
                <span className="sm:hidden">{slide.shortBadge}</span>
                <span className="hidden sm:inline"><span className="mr-1">{idx + 1}.</span> {slide.badge}</span>
              </button>
            ))}
          </div>

          {/* Active Slide Body */}
          <div className="grid md:grid-cols-12 gap-6 p-6 sm:p-8 items-center">
            {/* Slide Flyer Image with zoom hint */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div
                className="group relative h-80 sm:h-[400px] w-full max-w-xs cursor-pointer rounded-2xl overflow-hidden bg-slate-950/5 dark:bg-slate-950 border border-gray-200/80 dark:border-slate-700/60 shadow-inner flex items-center justify-center"
                onClick={() => openLightbox(currentSlide.image, currentSlide.title)}
                title="Натисніть для перегляду слайду на весь екран"
              >
                <img
                  src={currentSlide.image}
                  alt={currentSlide.title}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />

                {/* Overlay with zoom badge */}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-end justify-center p-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm border border-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    Натисніть для перегляду на весь екран
                  </span>
                </div>
              </div>

              {/* Callout below image */}
              <button
                type="button"
                onClick={() => openLightbox(currentSlide.image, currentSlide.title)}
                className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
              >
                <span>🔍</span> Розгорнути слайд у максимальній якості
              </button>
            </div>

            {/* Slide Text & Highlights */}
            <div className="md:col-span-7 flex flex-col gap-4">
              <span className="inline-flex self-start rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {currentSlide.badge}
              </span>

              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100">
                {currentSlide.title}
              </h3>

              <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400">
                {currentSlide.summary}
              </p>

              <div className="rounded-2xl bg-gray-50 dark:bg-slate-950 p-4 sm:p-5 border border-gray-100 dark:border-slate-800">
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-3">
                  Головні тези:
                </p>
                <ul className="flex flex-col gap-2.5">
                  {currentSlide.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-xs mt-0.5">
                        ✓
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Slide Navigation Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={activeSlideIndex === 0}
                  onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 active:scale-95"
                >
                  ← Попередній слайд
                </button>

                <div className="flex items-center gap-1.5">
                  {SUSHKA_INFO_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        idx === activeSlideIndex ? "w-6 bg-emerald-500" : "w-2.5 bg-gray-300 dark:bg-slate-700"
                      }`}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={activeSlideIndex === sushkaSlides.length - 1}
                  onClick={() => setActiveSlideIndex(prev => Math.min(sushkaSlides.length - 1, prev + 1))}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 active:scale-95"
                >
                  Наступний слайд →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tariffs Selection Section */}
        <div>
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100">
              Оберіть свій тариф Сушки
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Оберіть бажану калорійність та кількість прийомів їжі:
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Card 1: Sushka XS */}
            {xsOption && (
              <div className="flex flex-col rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      3 прийоми їжі
                    </span>
                    <h4 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-2">
                      {xsOption.title}
                    </h4>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {xsOption.kcal}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Базова ціна</p>
                    <p className="text-2xl font-black text-emerald-600">
                      {xsOption.price}
                    </p>
                  </div>
                </div>

                {/* Price Table Trigger with flyer thumbnail */}
                {(() => {
                  const xsFlyer = xsOption.imageUrl || "/images/sushka/prices-xs.jpg";
                  return (
                    <>
                      <div
                        className="group relative mb-5 h-44 w-full cursor-pointer rounded-2xl overflow-hidden bg-slate-950/5 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                        onClick={() => openLightbox(xsFlyer, "Ціни та знижки: Сушка XS")}
                      >
                        <img
                          src={xsFlyer}
                          alt="Сушка XS ціни"
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm border border-white/20">
                            🔍 Відкрити таблицю цін
                          </span>
                        </div>
                      </div>

                      {/* Subscription discount note & direct anchor link */}
                      <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🎟️</span>
                            <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                              Знижки до -10% в абонементі
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                            від 639 ₴/день
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                          Курс на 2 дні (тест-драйв -10%), 7 (-5%) або 14 днів (-10%) оформлюється зі знижкою через систему абонементів.
                        </p>
                        <Link
                          href="/profile?tab=subscription&pkg=Sushka+XS#purchase-subscription"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 transition shadow-sm mt-1"
                        >
                          <span>Оформити абонемент Сушка XS зі знижкою →</span>
                        </Link>
                      </div>

                      {/* Actions */}
                      <div className="mt-auto flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => openLightbox(xsFlyer, "Ціни та знижки: Сушка XS")}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-center flex items-center justify-center gap-1.5"
                        >
                          <span>📊</span> Переглянути офіційний флаєр цін
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectPackage(xsOption)}
                          className="w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-center"
                        >
                          Обрати Сушка XS (замовлення на день) →
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Card 2: Sushka S */}
            {sOption && (
              <div className="flex flex-col rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-3 py-1 text-xs font-bold text-blue-800 dark:text-blue-300">
                      4 прийоми їжі
                    </span>
                    <h4 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-2">
                      {sOption.title}
                    </h4>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {sOption.kcal}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Базова ціна</p>
                    <p className="text-2xl font-black text-emerald-600">
                      {sOption.price}
                    </p>
                  </div>
                </div>

                {/* Price Table Trigger with flyer thumbnail */}
                {(() => {
                  const sFlyer = sOption.imageUrl || "/images/sushka/prices-s.jpg";
                  return (
                    <>
                      <div
                        className="group relative mb-5 h-44 w-full cursor-pointer rounded-2xl overflow-hidden bg-slate-950/5 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                        onClick={() => openLightbox(sFlyer, "Ціни та знижки: Сушка S")}
                      >
                        <img
                          src={sFlyer}
                          alt="Сушка S ціни"
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm border border-white/20">
                            🔍 Відкрити таблицю цін
                          </span>
                        </div>
                      </div>

                      {/* Subscription discount note & direct anchor link */}
                      <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🎟️</span>
                            <p className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-200">
                              Знижки до -10% в абонементі
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                            від 693 ₴/день
                          </span>
                        </div>
                        <p className="text-xs text-blue-800/90 dark:text-blue-300/80 leading-relaxed">
                          Курс на 2 дні (тест-драйв -10%), 7 (-5%) або 14 днів (-10%) оформлюється зі знижкою через систему абонементів.
                        </p>
                        <Link
                          href="/profile?tab=subscription&pkg=Sushka+S#purchase-subscription"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-3 transition shadow-sm mt-1"
                        >
                          <span>Оформити абонемент Сушка S зі знижкою →</span>
                        </Link>
                      </div>

                      {/* Actions */}
                      <div className="mt-auto flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={() => openLightbox(sFlyer, "Ціни та знижки: Сушка S")}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-center flex items-center justify-center gap-1.5"
                        >
                          <span>📊</span> Переглянути офіційний флаєр цін
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectPackage(sOption)}
                          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all text-center"
                        >
                          Обрати Сушка S (замовлення на день) →
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {renderLightboxModal()}
      </div>
    );
  }

  return (
    <div
      key={1}
      className="w-full max-w-6xl mx-auto transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100">
          Оберіть свій раціон
        </h2>
        <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
          Свіже та збалансоване харчування на кожен день. Оберіть готову програму або складіть власний раціон.
        </p>

        {/* General Info Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => openLightbox(overviewFlyer, "Огляд програм Balance Food та розрахунок калоражу")}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-95"
          >
            <span>📋</span>
            <span>Огляд програм та калоражу</span>
          </button>
          <button
            type="button"
            onClick={() => openLightbox(extraCaloriesFlyer, "Раціони понад 2500 ккал (+35 грн/100 ккал)")}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-95"
          >
            <span>⚡</span>
            <span>Раціони понад 2500 ккал (+35 ₴ / 100 ккал)</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sortedMainItems.map((item) => {
          if ("type" in item && item.type === "sushka-folder") {
            return (
              <div
                key="sushka-folder"
                className="w-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm hover:shadow-md transition-all p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      🔥 Експрес-програма
                    </span>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-2">
                      Сушка «Light»
                    </h3>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      XS (3 прийоми) та S (4 прийоми)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Базова ціна</p>
                    <p className="text-2xl font-black text-emerald-600">
                      {sushkaPriceRange ? `від ${sushkaPriceRange.split("–")[0]}` : "від 710 ₴"}
                    </p>
                  </div>
                </div>

                <div 
                  className="group relative mb-5 h-44 w-full overflow-hidden bg-slate-950/5 dark:bg-slate-950 rounded-2xl border border-gray-200 dark:border-slate-800 cursor-pointer flex items-center justify-center"
                  onClick={openSushka}
                >
                  <img 
                    src={forWhomSlide} 
                    alt="Сушка Light програма" 
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm border border-white/20">
                      🔍 Відкрити презентацію Сушки
                    </span>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎟️</span>
                      <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Знижки до -10% в абонементі
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                      від 639 ₴/день
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                    Спеціалізоване білкове меню для виразного рельєфу та швидкого старту схуднення.
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={openSushka}
                    className="w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-center"
                  >
                    Переглянути деталі та тарифи →
                  </button>
                </div>
              </div>
            );
          }

          const pkg = item as Tariff;
          const rationMeta = RATION_FLYERS[pkg.name];
          const flyerUrl = pkg.imageUrl || rationMeta?.flyer;

          if (pkg.name.toLowerCase().includes("indiv")) {
            return (
              <div
                key={pkg.id}
                className="w-full flex flex-col rounded-3xl border border-purple-200/80 dark:border-purple-900/40 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-3 py-1 text-xs font-bold text-purple-800 dark:text-purple-300">
                      Індивідуальний підбір
                    </span>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-2">
                      {pkg.title}
                    </h3>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {pkg.kcal}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Ціна</p>
                    <p className="text-xl font-black text-purple-600">
                      Індивідуально
                    </p>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥗</span>
                    <p className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200">
                      Гнучкий раціон під ваші цілі
                    </p>
                  </div>
                  <p className="text-xs text-purple-800/90 dark:text-purple-300/80 leading-relaxed">
                    Складайте власний щоденний раціон (до 10 страв). Розраховуємо персональний калораж та добір понад 2500 ккал (+35 ₴ за 100 ккал).
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => openLightbox(overviewFlyer, "Огляд програм Balance Food та калоражу")}
                      className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800 px-2.5 py-1 rounded-lg transition"
                    >
                      📋 Розрахунок калоражу →
                    </button>
                    <button
                      type="button"
                      onClick={() => openLightbox(extraCaloriesFlyer, "Раціони понад 2500 ккал (+35 грн/100 ккал)")}
                      className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800 px-2.5 py-1 rounded-lg transition"
                    >
                      ⚡ Понад 2500 ккал →
                    </button>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectPackage(pkg)}
                    className="w-full rounded-2xl bg-purple-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-purple-700 active:scale-95 transition-all text-center"
                  >
                    Обрати Індивідуальний раціон →
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={pkg.id}
              className="w-full flex flex-col rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {rationMeta?.mealsCount || "Комплексний раціон"}
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-2">
                    {pkg.title}
                  </h3>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {pkg.kcal}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Базова ціна</p>
                  <p className="text-2xl font-black text-emerald-600">
                    {pkg.price}
                  </p>
                </div>
              </div>

              {/* Price Table Trigger with flyer thumbnail */}
              {flyerUrl && (
                <div
                  className="group relative mb-4 h-44 w-full cursor-pointer rounded-2xl overflow-hidden bg-slate-950/5 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                  onClick={() => openLightbox(flyerUrl, `Ціни та знижки: ${pkg.title}`)}
                >
                  <img
                    src={flyerUrl}
                    alt={`${pkg.title} ціни`}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm border border-white/20">
                      🔍 Відкрити таблицю цін
                    </span>
                  </div>
                </div>
              )}

              {/* Special Sport extra calories callout */}
              {pkg.name === "Sport" && (
                <button
                  type="button"
                  onClick={() => openLightbox(extraCaloriesFlyer, "Раціони понад 2500 ккал (+35 грн/100 ккал)")}
                  className="mb-4 w-full rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition flex items-center justify-center gap-1.5 text-center"
                >
                  <span>⚡</span>
                  <span>Потрібно понад 2500 ккал? +35 ₴ за кожні 100 ккал →</span>
                </button>
              )}

              {/* Subscription discount note & direct anchor link */}
              <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎟️</span>
                    <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Знижки до -15% в абонементі
                    </p>
                  </div>
                  {rationMeta?.minPriceDay && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                      {rationMeta.minPriceDay}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                  Курс на 2 дні (пробний -15%), 7 (-5%), 14 (-10%) або 30 днів (-15%) оформлюється зі знижкою через систему абонементів.
                </p>
                <Link
                  href={`/profile?tab=subscription&pkg=${encodeURIComponent(pkg.name)}#purchase-subscription`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 transition shadow-sm mt-1"
                >
                  <span>Оформити абонемент {pkg.title} зі знижкою →</span>
                </Link>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2.5">
                {flyerUrl && (
                  <button
                    type="button"
                    onClick={() => openLightbox(flyerUrl, `Ціни та знижки: ${pkg.title}`)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-center flex items-center justify-center gap-1.5"
                  >
                    <span>📊</span> Переглянути офіційний флаєр цін
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className="w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-center"
                >
                  Обрати {pkg.title} (замовлення на день) →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {renderLightboxModal()}
    </div>
  );
}
