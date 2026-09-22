import streetsData from "./zaporizhzhia-streets.json";

/**
 * Complete register of all 1,600+ streets, avenues, boulevards, squares, and alleys
 * in Zaporizhzhia, aggregated from locator.zp.ua and OpenStreetMap.
 */
export const ZAPORIZHZHIA_STREETS: string[] = streetsData as string[];

/**
 * Common renames in Zaporizhzhia (historical name -> official new name)
 * Allows users who remember previous names to effortlessly find their street.
 */
export const HISTORICAL_RENAMES: Record<string, string> = {
  "леніна": "просп. Соборний",
  "правди": "вул. Леоніда Жаботинського",
  "гагаріна": "вул. Дмитра Дорошенка",
  "лермонтова": "вул. В'ячеслава Зайцева",
  "маяковського": "бульв. Марії Примаченко",
  "жуковського": "вул. Університетська",
  "артема": "вул. Святого Миколая",
  "свердлова": "вул. Покровська",
  "дзержинського": "вул. Олександрівська",
  "горького": "вул. Поштова",
  "орджонікідзе": "вул. Академіка Амосова",
  "грязнова": "вул. Фортечна",
  "чекістів": "вул. Троїцька",
  "анголенка": "вул. Базарна",
  "героїв сталінграда": "вул. Шкільна",
  "красногвардійська": "вул. Перша Ливарна",
  "панфіловців": "вул. Михайла Гончаренка",
  "кремлівська": "вул. Сергія Синенка",
  "чуйкова": "вул. Професора Толока",
  "микояна": "вул. Богдана Завади",
  "малиновського": "вул. Європейська",
  "куйбишева": "вул. Ігоря Сікорського",
  "димитрова": "вул. Брюллова",
  "леваневського": "вул. Академіка Весніна",
  "вулиця правди": "вул. Леоніда Жаботинського",
  "проспект леніна": "просп. Соборний",
  "проспект маяковського": "бульв. Марії Примаченко",
  "бульвар шевченка": "бульв. Шевченка",
  "проспект металургів": "просп. Металургів"
};

export type LocalStreetResult = {
  name: string;
  road: string;
  houseNumber?: string;
};

/**
 * Fast local search for Zaporizhzhia streets with 0ms response time.
 * Supports Ukrainian & Russian typing, prefix matching, house number extraction, and historical alias lookup.
 */
export function searchLocalZaporizhzhiaStreets(query: string, limit = 8): LocalStreetResult[] {
  const rawQ = query.trim();
  if (!rawQ || rawQ.length < 2) return [];

  // Check if query ends with a house number: e.g. "Перемоги 24", "Соборний 150-а"
  const houseMatch = rawQ.match(/\s+(\d+[\wа-яА-ЯіїєґІЇЄҐ\/-]*)$/);
  const houseNumber = houseMatch ? houseMatch[1] : undefined;
  const streetPart = houseMatch ? rawQ.slice(0, houseMatch.index).trim() : rawQ;

  // Strip prefixes like "вул.", "вулиця", "просп.", "бульв.", "пров."
  const cleanQ = streetPart
    .toLowerCase()
    .replace(/^(вул\.?|вулиця|просп\.?|проспект|пров\.?|провулок|бульв\.?|бульвар|пл\.?|площа)\s+/i, "")
    .replace(/['’`-]/g, "")
    .trim();

  if (cleanQ.length < 2 && !houseNumber) return [];

  const exactMatches: string[] = [];
  const startsWithMatches: string[] = [];
  const containsMatches: string[] = [];
  const aliasMatches: string[] = [];

  // 1. Check historical renames
  for (const [oldName, officialName] of Object.entries(HISTORICAL_RENAMES)) {
    const cleanOld = oldName.replace(/['’`-]/g, "");
    if (cleanOld.startsWith(cleanQ) || cleanOld.includes(cleanQ)) {
      const aliasFormatted = `${officialName} (кол. ${oldName.charAt(0).toUpperCase() + oldName.slice(1)})`;
      aliasMatches.push(aliasFormatted);
    }
  }

  // 2. Check full street database
  for (const street of ZAPORIZHZHIA_STREETS) {
    const sLower = street.toLowerCase();
    const sClean = sLower
      .replace(/^(вул\.?|просп\.?|бульв\.?|пров\.?|пл\.?)\s+/i, "")
      .replace(/['’`-]/g, "")
      .trim();

    if (sClean === cleanQ) {
      exactMatches.push(street);
    } else if (sClean.startsWith(cleanQ)) {
      startsWithMatches.push(street);
    } else if (sClean.split(/\s+/).some((word) => word.startsWith(cleanQ))) {
      startsWithMatches.push(street);
    } else if (sLower.includes(cleanQ)) {
      containsMatches.push(street);
    }
  }

  const combined = Array.from(
    new Set([...exactMatches, ...aliasMatches, ...startsWithMatches, ...containsMatches])
  ).slice(0, limit);

  return combined.map((st) => {
    const isAlias = st.includes(" (кол.");
    const cleanRoad = isAlias ? st.split(" (кол.")[0] : st;
    const finalName = houseNumber ? `${cleanRoad}, ${houseNumber}` : st;
    return {
      name: finalName,
      road: cleanRoad,
      houseNumber,
    };
  });
}
