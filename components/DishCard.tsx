"use client";

type Props = {
  dishName: string;
  dishShort?: string;
  variantNumber?: number;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
};

export default function DishCard({ dishName, dishShort, variantNumber, isSelected, disabled, onClick }: Props) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onClick();
    e.currentTarget.blur();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      className={`relative w-full rounded-2xl p-4 text-left transition-all duration-200 ease-out md:p-5 active:scale-[0.99] ${
        isSelected
          ? "bg-emerald-50/90 dark:bg-emerald-950/60 border-2 border-emerald-500 shadow-md shadow-emerald-600/10"
          : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-md"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"} flex items-center gap-3`}
    >
      <div className="flex-1 min-w-0 pr-10">
        {variantNumber !== undefined && (
          <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md mb-1.5">
            <span>Варіант {variantNumber}</span>
          </div>
        )}
        <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 break-words leading-snug">
          {dishName}
        </div>
      </div>

      <div
        className={`absolute top-4 right-4 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 ${
          isSelected
            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105"
            : "border border-slate-300 dark:border-slate-700 text-transparent"
        }`}
      >
        <svg
          className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 ${isSelected ? "scale-100 animate-checkmark" : "scale-0"}`}
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
    </button>
  );
}
