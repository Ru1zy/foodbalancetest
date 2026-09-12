"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function SyncedHorizontalScroll({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);

  const [scrollWidth, setScrollWidth] = useState<number>(0);
  const [canScroll, setCanScroll] = useState<boolean>(false);
  const [floatingStyles, setFloatingStyles] = useState<{
    show: boolean;
    left: number;
    width: number;
  }>({ show: false, left: 0, width: 0 });

  const isSyncing = useRef(false);

  const updateMeasurementsAndPosition = useCallback(() => {
    if (!containerRef.current || !bottomScrollRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const sw = bottomScrollRef.current.scrollWidth;
    const cw = bottomScrollRef.current.clientWidth;
    const can = sw > cw + 2;

    setScrollWidth(sw);
    setCanScroll(can);

    if (!can) {
      setFloatingStyles((prev) => (prev.show ? { ...prev, show: false } : prev));
      return;
    }

    const windowH = window.innerHeight;
    // Table is in view
    const isTableInView = rect.top < windowH - 60 && rect.bottom > 80;
    // Native bottom scrollbar is below the bottom of the viewport
    const isBottomBelowViewport = rect.bottom > windowH;
    const show = isTableInView && isBottomBelowViewport;

    const left = Math.max(0, rect.left);
    const width = Math.min(window.innerWidth - left, rect.width);

    setFloatingStyles({
      show,
      left,
      width,
    });

    if (show && floatingScrollRef.current && bottomScrollRef.current) {
      floatingScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    updateMeasurementsAndPosition();

    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurementsAndPosition();
    });

    resizeObserver.observe(bottomEl);
    if (bottomEl.firstElementChild) {
      resizeObserver.observe(bottomEl.firstElementChild);
    }

    const handleScrollOrResize = () => {
      updateMeasurementsAndPosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [updateMeasurementsAndPosition]);

  const handleTopScroll = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sl = topScrollRef.current?.scrollLeft ?? 0;
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = sl;
    }
    if (floatingScrollRef.current) {
      floatingScrollRef.current.scrollLeft = sl;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  };

  const handleBottomScroll = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sl = bottomScrollRef.current?.scrollLeft ?? 0;
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = sl;
    }
    if (floatingScrollRef.current) {
      floatingScrollRef.current.scrollLeft = sl;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  };

  const handleFloatingScroll = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sl = floatingScrollRef.current?.scrollLeft ?? 0;
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = sl;
    }
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = sl;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  };

  const scrollByDelta = (delta: number) => {
    if (!bottomScrollRef.current) return;
    bottomScrollRef.current.scrollBy({
      left: delta,
      behavior: "smooth",
    });
  };

  return (
    <div ref={containerRef} className={`w-full relative ${className}`}>
      {/* Top synchronized scrollbar */}
      {canScroll && (
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          tabIndex={-1}
          aria-hidden="true"
          className="w-full overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 rounded-t-xl"
          style={{ height: "14px" }}
        >
          <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
        </div>
      )}

      {/* Main content scroll area with bottom scrollbar */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="w-full overflow-x-auto"
      >
        {children}
      </div>

      {/* Floating horizontal scrollbar when middle of the table is in view */}
      {floatingStyles.show && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: `${floatingStyles.left}px`,
            width: `${floatingStyles.width}px`,
            zIndex: 40,
          }}
          className="pointer-events-auto flex items-center gap-3 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-700/80 shadow-2xl px-4 py-2.5 rounded-t-xl transition-all duration-150"
        >
          <button
            type="button"
            onClick={() => scrollByDelta(-350)}
            className="flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition shadow-sm"
            title="Прокрутити вліво"
          >
            <span>◀</span>
            <span>Вліво</span>
          </button>

          <div
            ref={floatingScrollRef}
            onScroll={handleFloatingScroll}
            onWheel={(e) => {
              if (e.deltaY) {
                e.preventDefault();
                if (bottomScrollRef.current) {
                  bottomScrollRef.current.scrollLeft += e.deltaY;
                }
              }
            }}
            tabIndex={-1}
            aria-hidden="true"
            className="flex-1 overflow-x-auto overflow-y-hidden py-1 cursor-ew-resize"
            style={{ height: "16px" }}
          >
            <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
          </div>

          <button
            type="button"
            onClick={() => scrollByDelta(350)}
            className="flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            title="Прокрутити вправо"
          >
            <span>Вправо</span>
            <span>▶</span>
          </button>
        </div>
      )}
    </div>
  );
}
