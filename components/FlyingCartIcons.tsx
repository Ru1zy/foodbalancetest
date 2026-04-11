"use client";

import { useEffect, useState } from "react";

type FlyingIcon = {
  id: number;
  startX: number;
  startY: number;
};

let iconIdCounter = 0;

export function useFlyToCart() {
  const [flyingIcons, setFlyingIcons] = useState<FlyingIcon[]>([]);

  const triggerFly = (sourceElement: HTMLElement) => {
    const rect = sourceElement.getBoundingClientRect();
    const icon: FlyingIcon = {
      id: iconIdCounter++,
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
    };

    setFlyingIcons((prev) => [...prev, icon]);

    setTimeout(() => {
      setFlyingIcons((prev) => prev.filter((i) => i.id !== icon.id));
    }, 1000);
  };

  return { flyingIcons, triggerFly };
}

type Props = {
  flyingIcons: FlyingIcon[];
};

export default function FlyingCartIcons({ flyingIcons }: Props) {
  return (
    <>
      {flyingIcons.map((icon) => (
        <div
          key={icon.id}
          className="fixed z-[60] pointer-events-none"
          style={{
            left: icon.startX,
            top: icon.startY,
            animation: "flyToCart 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
          }}
        >
          <svg
            className="h-8 w-8 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      ))}

      <style jsx>{`
        @keyframes flyToCart {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(calc(100vw - 100%), -50vh) scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: translate(calc(100vw - 50px), -90vh) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
