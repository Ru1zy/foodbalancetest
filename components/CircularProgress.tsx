"use client";

type Props = {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
};

export default function CircularProgress({ current, total, size = 60, strokeWidth = 6 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = total > 0 ? (current / total) * 100 : 0;
  const offset = circumference - (progress / 100) * circumference;
  const isComplete = current === total && total > 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-500 ease-out ${
            isComplete ? "text-green-500" : "text-blue-500"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isComplete ? (
          <svg
            className="h-6 w-6 text-green-500 animate-checkmark"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <>
            <span className="text-sm font-bold text-gray-900">{current}</span>
            <span className="text-[10px] text-gray-500">/{total}</span>
          </>
        )}
      </div>
    </div>
  );
}
