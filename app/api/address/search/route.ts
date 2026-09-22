import { NextRequest, NextResponse } from "next/server";
import { searchLocalZaporizhzhiaStreets } from "@/lib/zaporizhzhia-streets";

type CacheEntry = {
  timestamp: number;
  data: AddressSearchResult[];
};

export type AddressSearchResult = {
  id: string;
  name: string;
  road: string;
  houseNumber?: string;
  displayName: string;
  lat?: number;
  lon?: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.data });
  }

  // 1. Get instant local matches
  const localMatches = searchLocalZaporizhzhiaStreets(query, 8);
  const localResults: AddressSearchResult[] = localMatches.map((item, idx) => ({
    id: `local-${idx}-${item.name}`,
    name: item.name,
    road: item.road,
    houseNumber: item.houseNumber,
    displayName: `${item.name}, Запоріжжя`,
  }));

  // 2. Fetch external OpenStreetMap Nominatim results
  const externalResults: AddressSearchResult[] = [];
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + " Запоріжжя"
    )}&format=json&addressdetails=1&countrycodes=ua&limit=6`;

    const res = await fetch(osmUrl, {
      headers: {
        "User-Agent": "FoodBalanceApp-Delivery/1.0 (info@foodbalance.com.ua)",
        "Accept-Language": "uk, uk-UA",
      },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        for (const item of items) {
          const addr = item.address || {};
          // Only accept results inside Zaporizhzhia or Zaporizhzhia district
          const isZp =
            addr.city === "Запоріжжя" ||
            addr.town === "Запоріжжя" ||
            addr.state === "Запорізька область" ||
            item.display_name?.includes("Запоріжжя");

          if (!isZp) continue;

          const road = addr.road || addr.pedestrian || addr.street || item.name;
          const house = addr.house_number;
          if (road) {
            const label = house ? `${road}, ${house}` : road;
            externalResults.push({
              id: String(item.place_id || item.osm_id),
              name: label,
              road: road,
              houseNumber: house,
              displayName: item.display_name,
              lat: item.lat ? parseFloat(item.lat) : undefined,
              lon: item.lon ? parseFloat(item.lon) : undefined,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("OSM Nominatim search error:", err);
  }

  // Combine and deduplicate
  const seen = new Set<string>();
  const combined: AddressSearchResult[] = [];

  for (const item of [...externalResults, ...localResults]) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  const finalResults = combined.slice(0, 8);
  cache.set(cacheKey, { timestamp: Date.now(), data: finalResults });

  return NextResponse.json({ results: finalResults });
}
