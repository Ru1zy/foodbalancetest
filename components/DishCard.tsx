"use client";

import { useState, useRef } from "react";

type Props = {
  dishName: string;
  dishShort?: string;
  variantNumber?: number;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  onFlyAnimation?: (element: HTMLElement) => void;
};

export default function DishCard({ dishName, dishShort, variantNumber, isSelected, disabled, onClick, onFlyAnimation }: Props) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = { x, y, id: Date.now() };
    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    // Trigger fly animation if selecting (not deselecting)
    if (!isSelected && onFlyAnimation && cardRef.current) {
      onFlyAnimation(cardRef.current);
    }

    onClick();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <button
      ref={cardRef}
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full rounded-xl p-4 text-left transition-all duration-300 overflow-hidden ${
        isSelected
          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-105"
          : "bg-white text-gray-800 shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-300"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
      style={{
        transform: disabled ? undefined : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
          }}
        />
      ))}

      {/* Checkmark animation */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm animate-checkmark">
          <svg
            className="h-5 w-5 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="relative" style={{ transform: "translateZ(20px)" }}>
        <div className={`font-semibold text-sm mb-1 ${isSelected ? "text-white" : "text-gray-900"}`}>
          {dishName}
        </div>
        {dishShort && dishShort !== dishName && (
          <div className={`text-xs ${isSelected ? "text-white/80" : "text-gray-500"}`}>
            {dishShort}
          </div>
        )}
        {variantNumber !== undefined && (
          <div className={`mt-2 text-[9px] font-bold tracking-wider ${isSelected ? "text-white/90" : "text-blue-500"}`}>
            ВАРІАНТ {variantNumber}
          </div>
        )}
      </div>

      {/* Shine effect on hover */}
      {!disabled && !isSelected && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine" />
        </div>
      )}
    </button>
  );
}
