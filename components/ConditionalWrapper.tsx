"use client";

import { usePathname } from "next/navigation";

export default function ConditionalWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith("/admin");
  const isAuthErrorPage = pathname === "/auth/error";

  if (isAdminPage || isAuthErrorPage) {
    return null;
  }

  return <>{children}</>;
}
