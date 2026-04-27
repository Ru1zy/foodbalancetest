"use client";

type Props = {
  dishName: string;
  dishShort?: string;
  variantNumber?: number;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
};

export default function DishCard({ dishName, isSelected, disabled, onClick }: Props) {
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
      className={`relative w-full rounded-2xl p-4 text-left transition-all duration-200 ease-out md:p-5 active:scale-95 ${
        isSelected
          ? "bg-emerald-50 border-2 border-emerald-500 shadow-md"
          : "bg-white border border-gray-100 shadow-sm hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"} flex items-center`}
    >
      <div className="flex-1 text-lg md:text-xl font-semibold text-slate-700 break-words pr-12">
        {dishName}
      </div>

      {isSelected && (
        <div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
          <svg
            className="h-6 w-6 text-white"
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
    </button>
  );
}
