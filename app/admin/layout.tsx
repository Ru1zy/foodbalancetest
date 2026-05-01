import { notFound } from "next/navigation";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    notFound();
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
