import { Star } from "lucide-react";

type Props = {
  rating: number; // e.g. 4.5, 4.3, 5.0
  maxStars?: number; // default 5
  sizeClass?: string; // e.g. "h-4 w-4"
  starSizePx?: number; // default 16
  className?: string;
};

export default function FractionalRatingStars({
  rating,
  maxStars = 5,
  sizeClass = "h-4 w-4",
  starSizePx = 16,
  className = "",
}: Props) {
  return (
    <div
      className={`flex items-center text-amber-400 ${className}`}
      aria-label={`Оцінка: ${rating.toFixed(1)} з ${maxStars}`}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starNum = i + 1;
        const fill = Math.max(0, Math.min(100, Math.round((rating - i) * 100)));

        return (
          <div
            key={starNum}
            className={`relative inline-block ${sizeClass} mr-0.5 last:mr-0 shrink-0`}
            style={{ width: `${starSizePx}px`, height: `${starSizePx}px` }}
          >
            {/* Background empty star */}
            <Star
              className={`absolute inset-0 ${sizeClass} text-slate-300 dark:text-slate-600`}
              strokeWidth={2}
            />

            {/* Foreground filled star (clipped horizontally by fill%) */}
            {fill > 0 && (
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${fill}%` }}
              >
                <Star
                  className={`${sizeClass} fill-amber-400 text-amber-400 shrink-0`}
                  strokeWidth={2}
                  style={{
                    width: `${starSizePx}px`,
                    height: `${starSizePx}px`,
                    minWidth: `${starSizePx}px`,
                    minHeight: `${starSizePx}px`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
