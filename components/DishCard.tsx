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
    if (disabled) return;
    onClick();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`relative w-full rounded-xl p-4 text-left transition-colors ${
        isSelected
          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
          : "bg-white text-gray-800 shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-300"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
    >
      {/* Checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
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

      <div>
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
    </button>
  );
}
