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
      className={`relative w-full overflow-hidden rounded-xl p-3 pr-12 text-left transition-colors md:p-4 md:pr-14 ${
        isSelected
          ? "bg-green-50/50 border-2 border-green-500 text-gray-900"
          : "bg-white border-2 border-transparent ring-1 ring-gray-200 hover:border-gray-300"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
    >
      {/* Checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
          <svg
            className="h-5 w-5 text-green-600"
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

      <div className="min-w-0">
        <div className="mb-1 break-words text-sm font-semibold leading-snug text-gray-900">
          {dishName}
        </div>
        {dishShort && dishShort !== dishName && (
          <div className="break-words text-xs leading-snug text-gray-500">
            {dishShort}
          </div>
        )}
        {variantNumber !== undefined && (
          <div className="mt-2 break-words text-[9px] font-bold tracking-wider text-gray-500">
            ВАРІАНТ {variantNumber}
          </div>
        )}
      </div>
    </button>
  );
}
