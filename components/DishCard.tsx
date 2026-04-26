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
      className={`w-full rounded-xl p-4 text-left transition-shadow md:p-5 ${
        isSelected
          ? "bg-gradient-to-br from-green-50 to-emerald-50/30 border-2 border-emerald-400"
          : "bg-white shadow-sm hover:shadow-md border border-slate-100"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"} flex items-center`}
    >
      <div className="flex-1 text-lg md:text-xl font-semibold text-slate-800 break-words">
        {dishName}
      </div>

      {isSelected && (
        <div className="flex-shrink-0 ml-4">
          <svg
            className="w-6 h-6 text-green-600"
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
