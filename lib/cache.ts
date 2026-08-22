import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

export const getCachedMenus = unstable_cache(
  async () => {
    return prisma.menu.findMany();
  },
  ["menus-cache"],
  { tags: ["menus"] },
);

export const getCachedTariffs = unstable_cache(
  async () => {
    return prisma.tariff.findMany();
  },
  ["tariffs-cache"],
  { tags: ["tariffs"] },
);
