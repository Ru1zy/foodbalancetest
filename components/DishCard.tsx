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
      className={`w-full rounded-2xl p-4 text-left transition-all duration-200 ease-out md:p-5 active:scale-95 ${
        isSelected
          ? "bg-emerald-50 border-2 border-emerald-500 shadow-md"
          : "bg-white border border-gray-100 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"} flex items-center`}
    >
      <div className="flex-1 text-lg md:text-xl font-semibold text-slate-700 break-words">
        {dishName}
      </div>

      {isSelected && (
        <div className="flex-shrink-0 ml-4">
          <svg
            className="w-6 h-6 text-emerald-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
