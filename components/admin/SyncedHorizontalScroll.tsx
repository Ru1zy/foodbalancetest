"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function SyncedHorizontalScroll({ children, className = "" }: Props) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(0);
  const [canScroll, setCanScroll] = useState<boolean>(false);
  const isSyncing = useRef(false);

  const updateMeasurements = useCallback(() => {
    if (!bottomScrollRef.current) return;
    const sw = bottomScrollRef.current.scrollWidth;
    const cw = bottomScrollRef.current.clientWidth;
    setScrollWidth(sw);
    setCanScroll(sw > cw + 2);
  }, []);

  useEffect(() => {
    updateMeasurements();

    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurements();
    });

    resizeObserver.observe(bottomEl);
    if (bottomEl.firstElementChild) {
      resizeObserver.observe(bottomEl.firstElementChild);
    }

    window.addEventListener("resize", updateMeasurements);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [updateMeasurements]);

  const handleTopScroll = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  };

  const handleBottomScroll = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  };

  return (
    <div className={`w-full relative ${className}`}>
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
    </div>
  );
}
