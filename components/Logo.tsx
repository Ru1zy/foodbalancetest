"use client";

import { useOrderStore } from "@/lib/orderStore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Logo() {
  const hardReset = useOrderStore((state) => state.hardReset);
  const router = useRouter();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    hardReset();
    router.push("/");
  };

  return (
    <Link href="/" onClick={handleLogoClick} className="flex items-center gap-3 group">
      <div className="relative">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl drop-shadow-sm">
          <img src="/foodbalancelogo.png" alt="Food Balance" className="h-full w-full object-cover mix-blend-multiply" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black flex gap-1">
          <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent drop-shadow-sm">Food</span>
          <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent drop-shadow-sm">Balance</span>
        </div>
        <div className="text-xs text-gray-500 font-medium">Здорове харчування</div>
      </div>
    </Link>
  );
}
