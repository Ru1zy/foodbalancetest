import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);

  // Restrict to Zaporizhzhia metropolitan & immediate delivery area
  if (
    isNaN(numLat) ||
    isNaN(numLon) ||
    numLat < 47.65 ||
    numLat > 48.05 ||
    numLon < 34.85 ||
    numLon > 35.45
  ) {
    return NextResponse.json({
      outOfZone: true,
      error: "OUT_OF_DELIVERY_ZONE",
      message: "Доставка здійснюється тільки по м. Запоріжжя",
    });
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=uk`;

    const res = await fetch(osmUrl, {
      headers: {
        "User-Agent": "FoodBalanceApp-Delivery/1.0 (info@foodbalance.com.ua)",
        "Accept-Language": "uk, uk-UA",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: res.status });
    }

    const data = await res.json();
    const addr = data.address || {};
    const road = addr.road || addr.pedestrian || addr.street || "";
    const houseNumber = addr.house_number || "";
    const quarter = addr.quarter || addr.suburb || addr.city_district || "";

    const fullStreet = houseNumber && road ? `${road}, ${houseNumber}` : road || data.name || "";

    return NextResponse.json({
      road,
      houseNumber,
      quarter,
      fullStreet,
      displayName: data.display_name,
    });
  } catch (err) {
    console.error("Nominatim reverse error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
