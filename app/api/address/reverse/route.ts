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

  // Restrict strictly to Zaporizhzhia city delivery bounds (excluding Kushuhum, Balabyne, etc.)
  // South of Komunarskyi (Pisky) ends around ~47.765
  if (
    isNaN(numLat) ||
    isNaN(numLon) ||
    numLat < 47.765 ||
    numLat > 47.935 ||
    numLon < 34.985 ||
    numLon > 35.315
  ) {
    return NextResponse.json({
      outOfZone: true,
      error: "OUT_OF_DELIVERY_ZONE",
      message: "Доставка здійснюється тільки по м. Запоріжжя (Кушугум, Балабине та передмістя поза зоною)",
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

    const settlementText = [
      addr.village,
      addr.town,
      addr.hamlet,
      addr.suburb,
      addr.municipality,
      data.display_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const isExcludedSuburbs = [
      "кушугум",
      "kushuhum",
      "балабине",
      "balabyne",
      "малокатеринівка",
      "malokaterynivka",
      "вільнянськ",
      "vilniansk",
      "наталівка",
      "natalivka",
      "розумівка",
      "rozumivka",
      "михайлівка",
      "степне",
      "новоолександрівка",
    ].some((name) => settlementText.includes(name));

    const city = (addr.city || addr.town || addr.village || addr.municipality || "").toLowerCase();

    if (
      isExcludedSuburbs ||
      (city && !city.includes("запоріжжя") && !city.includes("zaporizhzhia"))
    ) {
      return NextResponse.json({
        outOfZone: true,
        error: "OUT_OF_DELIVERY_ZONE",
        message: "Доставка здійснюється тільки по м. Запоріжжя",
      });
    }

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
