"use client";

import { useEffect, useRef } from "react";

export default function MagneticButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = 100;

      if (distance < maxDistance) {
        const strength = (maxDistance - distance) / maxDistance;
        const moveX = x * strength * 0.3;
        const moveY = y * strength * 0.3;

        button.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
      } else {
        button.style.transform = "translate(0, 0) scale(1)";
      }
    };

    const handleMouseLeave = () => {
      button.style.transform = "translate(0, 0) scale(1)";
    };

    document.addEventListener("mousemove", handleMouseMove);
    button.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      button.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      className={`transition-all duration-200 ease-out ${className}`}
      style={{ willChange: "transform" }}
    >
      {children}
    </button>
  );
}
