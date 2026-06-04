const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_MODEL = "llama3.1";

const DESTINATIONS = [
  {
    name: "Lào Cai",
    aliases: ["lao cai", "lào cai", "laocai"],
    tag: "Núi rừng",
    days: 5,
    cost: "4–10 triệu",
    center: [22.485, 103.972],
    description: "Cửa ngõ vùng Tây Bắc, hợp cho combo Sa Pa, Bắc Hà, Y Tý và hành trình săn mây.",
    weatherHint: "Vùng núi dễ có sương/mưa rào, nên ưu tiên lịch linh hoạt theo thời tiết.",
  },
  {
    name: "Sa Pa",
    aliases: ["sa pa", "sapa"],
    tag: "Núi rừng",
    days: 3,
    cost: "3.5–8 triệu",
    center: [22.3364, 103.8438],
    description: "Ruộng bậc thang, Fansipan và các bản làng.",
    weatherHint: "Trời quang, ít mưa sẽ rất hợp trekking và săn mây.",
  },
  {
    name: "Hà Nội",
    aliases: ["ha noi", "hanoi"],
    tag: "Lịch sử",
    days: 3,
    cost: "3–7 triệu",
    center: [21.0285, 105.8542],
    description: "Thủ đô, hợp cho ăn uống, phố cổ và di tích.",
    weatherHint: "Mùa thu và mùa xuân thường dễ chịu hơn.",
  },
  {
    name: "Đà Nẵng",
    aliases: ["da nang", "danang"],
    tag: "Biển",
    days: 3,
    cost: "4–10 triệu",
    center: [16.0479, 108.2208],
    description: "Biển, city break và dễ kết hợp Hội An.",
    weatherHint: "Mùa khô có lợi thế cho biển và hoạt động ngoài trời.",
  },
  {
    name: "Hội An",
    aliases: ["hoi an", "hoian"],
    tag: "Cổ đại",
    days: 2,
    cost: "2–5 triệu",
    center: [15.8801, 108.338],
    description: "Phố cổ, đèn lồng và ẩm thực.",
    weatherHint: "Buổi tối ít mưa là đẹp nhất.",
  },
];

const STATIC_SPOTS = {
  "Lào Cai": [
    "Cửa khẩu quốc tế Lào Cai",
    "Chợ Cốc Lếu",
    "Đền Thượng",
    "Ga Lào Cai",
    "Sa Pa",
    "Bắc Hà",
    "Y Tý",
  ],
  "Sa Pa": [
    "Nhà thờ đá Sa Pa",
    "Sun World Fansipan Legend",
    "Bản Cát Cát",
    "Tả Van",
    "Thung lũng Mường Hoa",
  ],
  "Hà Nội": ["Hồ Hoàn Kiếm", "Văn Miếu", "Phố cổ Hà Nội", "Lăng Bác"],
  "Đà Nẵng": ["Bãi biển Mỹ Khê", "Cầu Rồng", "Ngũ Hành Sơn", "Bà Nà Hills"],
  "Hội An": ["Phố cổ Hội An", "Cù Lao Chàm", "Rừng dừa Bảy Mẫu"],
};

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function findDestination(query, trip) {
  const normalized = normalizeText(query);
  const tripDest = trip?.destination ? normalizeText(trip.destination) : "";
  return DESTINATIONS.find((dest) => {
    const key = normalizeText(dest.name);
    return normalized.includes(key) || normalized.includes(tripDest) || dest.aliases.some((alias) => normalized.includes(alias));
  });
}

function extractDays(query, fallback = 3) {
  const normalized = normalizeText(query);
  const match = normalized.match(/(\d+)\s*ngay/);
  if (!match) return fallback;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : fallback;
}

function buildDestinationSuggestion(dest) {
  return {
    name: dest.name,
    tag: dest.tag,
    days: dest.days,
    cost: dest.cost,
    img:
      dest.name === "Lào Cai"
        ? "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80"
        : dest.name === "Sa Pa"
          ? "https://images.unsplash.com/photo-1780236250852-3971a716cdb7?w=400&q=80"
          : dest.name === "Hà Nội"
            ? "https://images.unsplash.com/photo-1543355890-20bc0a26fda1?w=400&q=80"
            : dest.name === "Đà Nẵng"
              ? "https://images.unsplash.com/photo-1732243395944-cb3ff9311091?w=400&q=80"
              : "https://images.unsplash.com/photo-1569271532956-3fb81a207115?w=400&q=80",
    reason: dest.description,
  };
}

function haversineKm(a, b) {
  const toRad = (n) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

function fallbackTravelEstimate(origin, destination) {
  const km = Math.max(0.5, haversineKm(origin, destination) * 1.35);
  const minutes = Math.max(5, Math.round(km * 4.2));
  const mode = km < 2 ? "🚶" : km < 6 ? "🛵" : "🚗";
  return { km: Number(km.toFixed(1)), minutes, mode, source: "estimate" };
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildWeatherUrl(destination) {
  const url = new URL(process.env.WEATHER_API_URL || "https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", destination.name);
  url.searchParams.set("appid", process.env.WEATHER_API_KEY || "");
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "vi");
  url.searchParams.set("lat", String(destination.center[0]));
  url.searchParams.set("lon", String(destination.center[1]));
  return url.toString();
}

function parseWeather(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.weather) && payload.main) {
    return {
      tempC: typeof payload.main.temp === "number" ? payload.main.temp : undefined,
      feelsLikeC: typeof payload.main.feels_like === "number" ? payload.main.feels_like : undefined,
      humidity: typeof payload.main.humidity === "number" ? payload.main.humidity : undefined,
      windMs: typeof payload.wind?.speed === "number" ? payload.wind.speed : undefined,
      description: typeof payload.weather?.[0]?.description === "string" ? payload.weather[0].description : undefined,
    };
  }
  return null;
}

async function fetchWeather(destination) {
  if (!process.env.WEATHER_API_KEY) return null;
  const payload = await fetchJson(buildWeatherUrl(destination));
  return parseWeather(payload);
}

function buildOverpassQuery(destination) {
  const [lat, lon] = destination.center;
  return `
[out:json][timeout:25];
(
  node["tourism"~"attraction|museum|viewpoint|gallery|zoo|theme_park"](around:6000,${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint|gallery|zoo|theme_park"](around:6000,${lat},${lon});
  relation["tourism"~"attraction|museum|viewpoint|gallery|zoo|theme_park"](around:6000,${lat},${lon});
  node["amenity"~"restaurant|cafe|fast_food|food_court"](around:4000,${lat},${lon});
  way["amenity"~"restaurant|cafe|fast_food|food_court"](around:4000,${lat},${lon});
);
out center 35;
`.trim();
}

function mapOverpassElements(elements) {
  return (elements || [])
    .map((element) => {
      const tags = element?.tags || {};
      const name = typeof tags.name === "string" ? tags.name : "";
      const lat = typeof element.lat === "number" ? element.lat : typeof element.center?.lat === "number" ? element.center.lat : null;
      const lon = typeof element.lon === "number" ? element.lon : typeof element.center?.lon === "number" ? element.center.lon : null;
      if (!name || lat === null || lon === null) return null;
      return {
        name,
        type: tags.tourism || tags.amenity || "attraction",
        lat,
        lng: lon,
        address: tags["addr:full"] || tags["addr:street"] || tags["addr:place"] || tags["contact:address"] || "",
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

async function searchAttractions(destination) {
  const payload = await fetchJson(
    process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: buildOverpassQuery(destination),
    }
  );

  const spots = mapOverpassElements(payload?.elements);
  if (spots.length > 0) return spots;

  return (STATIC_SPOTS[destination.name] || []).map((name) => ({
    name,
    type: "tourism",
    lat: destination.center[0],
    lng: destination.center[1],
    address: destination.name,
  }));
}

function estimateTravelSegment(origin, destination) {
  const travelUrl = process.env.TRAVEL_TIME_API_URL;
  if (!travelUrl) return fallbackTravelEstimate(origin.coords, destination.coords);
  return fetchJson(travelUrl, {
    method: (process.env.TRAVEL_TIME_API_METHOD || "GET").toUpperCase() === "POST" ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:
      (process.env.TRAVEL_TIME_API_METHOD || "GET").toUpperCase() === "POST"
        ? JSON.stringify({
            origin: origin.name,
            destination: destination.name,
            from: origin.name,
            to: destination.name,
            originLat: origin.coords[0],
            originLng: origin.coords[1],
            destinationLat: destination.coords[0],
            destinationLng: destination.coords[1],
            key: process.env.TRAVEL_TIME_API_KEY || "",
            apiKey: process.env.TRAVEL_TIME_API_KEY || "",
          })
        : undefined,
  }).then((payload) => {
    if (!payload || typeof payload !== "object") return fallbackTravelEstimate(origin.coords, destination.coords);
    const rawMinutes =
      payload.minutes ??
      payload.durationMinutes ??
      payload.duration_minutes ??
      payload.travelTimeMinutes ??
      payload.travel_time_minutes ??
      payload.routes?.[0]?.duration ??
      payload.routes?.[0]?.duration_minutes;
    const rawKm =
      payload.km ??
      payload.distanceKm ??
      payload.distance_km ??
      payload.distance ??
      payload.routes?.[0]?.distance ??
      payload.routes?.[0]?.distance_km;

    if (typeof rawMinutes !== "number") return fallbackTravelEstimate(origin.coords, destination.coords);
    const km = typeof rawKm === "number" ? rawKm : Number((haversineKm(origin.coords, destination.coords) * 1.35).toFixed(1));
    return {
      km,
      minutes: Math.max(1, Math.round(rawMinutes)),
      mode: km < 2 ? "🚶" : km < 6 ? "🛵" : "🚗",
      source: "api",
    };
  });
}

function buildPrompt({ userMessage, destination, days, weather, attractions, travelSegments, itinerary }) {
  return [
    "Bạn là trợ lý lập lịch trình du lịch Việt Nam.",
    "Trả lời bằng tiếng Việt tự nhiên, ngắn gọn nhưng đủ thông tin.",
    "Không bịa số liệu nếu dữ liệu không có trong context.",
    "Ưu tiên Lào Cai/Sa Pa nếu người dùng nhắc đến Lào Cai.",
    "",
    `Tin nhắn người dùng: ${userMessage}`,
    "",
    `Bối cảnh: ${JSON.stringify({ destination, days, weather, attractions, travelSegments, itinerary }, null, 2)}`,
    "",
    "Yêu cầu:",
    "- Nếu có điểm đến, hãy chốt kế hoạch phù hợp với số ngày.",
    "- Nhắc thời tiết nếu có dữ liệu.",
    "- Nêu 3 đến 5 điểm nổi bật hoặc khung ngày chính.",
    "- Nếu đủ dữ liệu, đề xuất bước tiếp theo để thêm điểm vào lịch trình.",
  ].join("\n");
}

async function callLLM(prompt) {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const baseUrl =
    process.env.LLM_BASE_URL ||
    (provider === "ollama"
      ? "http://localhost:11434/v1"
      : "https://api.openai.com/v1");
  const model = process.env.LLM_MODEL || (provider === "ollama" ? DEFAULT_OLLAMA_MODEL : DEFAULT_MODEL);
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Bạn là trợ lý du lịch có khả năng lập lịch trình và giải thích ngắn gọn." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content?.trim() || "";
}

function buildActions(destination, days, spots) {
  const actions = [
    {
      label: `📅 Lập lịch ${destination.name} ${days} ngày`,
      variant: "primary",
      chatAction: { type: "start_planning", payload: { destination: destination.name, days } },
    },
  ];

  for (const spot of spots.slice(0, 3)) {
    actions.push({
      label: `➕ ${spot.name}`,
      variant: "add",
      chatAction: {
        type: "add_activity",
        payload: {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: spot.name,
          address: spot.address || destination.name,
          cost: 0,
          type: /food|cafe|restaurant|fast_food/i.test(spot.type) ? "food" : "sightseeing",
          startTime: "09:00",
          endTime: "11:00",
          note: `Gợi ý tự động cho ${destination.name}`,
        },
      },
    });
  }

  return actions;
}

function buildItinerarySketch(destination, days, spots) {
  if (destination.name !== "Lào Cai") {
    return spots.slice(0, Math.min(5, spots.length)).map((spot, index) => ({
      day: index + 1,
      title: spot.name,
      note: spot.address || destination.name,
    }));
  }

  const templates = [
    { day: 1, title: "Lào Cai city tour", note: "Cửa khẩu quốc tế Lào Cai, chợ Cốc Lếu, Đền Thượng, ga Lào Cai" },
    { day: 2, title: "Sa Pa trung tâm", note: "Nhà thờ đá, quảng trường, Hàm Rồng, chợ đêm" },
    { day: 3, title: "Fansipan - bản làng", note: "Fansipan, Tả Van, Lao Chải, ruộng bậc thang" },
    { day: 4, title: "Bắc Hà", note: "Chợ phiên Bắc Hà, dinh Hoàng A Tưởng, văn hoá bản địa" },
    { day: 5, title: "Y Tý / Bát Xát", note: "Săn mây, ruộng bậc thang, cảnh núi cao" },
  ];

  return templates.slice(0, days).map((item) => item);
}

function buildFallbackContent(destination, days, weather, spots, itinerary, travelSegments) {
  const weatherLine = weather
    ? `Thời tiết: ${typeof weather.tempC === "number" ? `${weather.tempC.toFixed(0)}°C` : "không rõ nhiệt độ"}${weather.description ? `, ${weather.description}` : ""}`
    : destination.weatherHint;
  const spotLines = spots.slice(0, 5).map((spot, index) => `${index + 1}. ${spot.name}`).join("\n");
  const travelLine =
    travelSegments.length > 0
      ? `Ước tính di chuyển: ${travelSegments[0].km.toFixed(1)} km, ${travelSegments[0].minutes} phút (${travelSegments[0].mode})`
      : "";
  const itineraryLines = itinerary.map((item) => `- Ngày ${item.day}: ${item.title} (${item.note})`).join("\n");

  return [
    `Tôi đã lên khung ${days} ngày cho ${destination.name}.`,
    weatherLine ? `\n${weatherLine}` : "",
    spotLines ? `\nĐiểm nổi bật:\n${spotLines}` : "",
    itineraryLines ? `\nKhung lịch trình:\n${itineraryLines}` : "",
    travelLine ? `\n${travelLine}` : "",
    "\nNếu bạn muốn, tôi có thể thêm ngay các điểm này vào lịch trình bên phải.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runTravelAgent(message, trip = {}) {
  const destination = findDestination(message, trip) || findDestination(trip.destination || "", trip) || DESTINATIONS[0];
  const days = extractDays(message, trip.days || destination.days || 3);
  const normalized = normalizeText(message);
  const wantsSuggestions = normalized.includes("goi y") && (normalized.includes("diem den") || normalized.includes("du lich") || normalized.includes("di dau"));
  const wantsWeather = normalized.includes("thoi tiet") || normalized.includes("du bao") || normalized.includes("mua");
  const wantsTravelTime = normalized.includes("mat bao lau") || normalized.includes("di tu") || normalized.includes("quang duong");

  if (wantsSuggestions) {
    const picks = DESTINATIONS.slice(0, 5);
    return {
      content:
        "Tôi đã nạp một số điểm đến phù hợp. Chọn một điểm bên dưới để tạo lịch trình ngay.",
      sideEffects: [
        {
          type: "suggest_destinations",
          payload: picks.map(buildDestinationSuggestion),
        },
      ],
      actions: picks.map((dest) => ({
        label: `📅 ${dest.name} - ${dest.days} ngày`,
        variant: "primary",
        chatAction: { type: "start_planning", payload: { destination: dest.name, days: dest.days } },
      })),
    };
  }

  const weather = wantsWeather || destination ? await fetchWeather(destination) : null;
  const spots = await searchAttractions(destination);
  const itinerary = buildItinerarySketch(destination, days, spots);
  const travelSegments = [];
  if (spots.length > 1) {
    const first = spots[0];
    const second = spots[1];
    travelSegments.push(
      await estimateTravelSegment(
        { name: first.name, coords: [first.lat, first.lng] },
        { name: second.name, coords: [second.lat, second.lng] }
      )
    );
  }

  let content = "";
  try {
    const prompt = buildPrompt({
      userMessage: message,
      destination,
      days,
      weather,
      attractions: spots.slice(0, 8),
      travelSegments,
      itinerary,
    });
    content = await callLLM(prompt);
  } catch {
    content = buildFallbackContent(destination, days, weather, spots, itinerary, travelSegments);
  }

  if (!content) {
    content = buildFallbackContent(destination, days, weather, spots, itinerary, travelSegments);
  }

  return {
    content,
    actions: buildActions(destination, days, spots),
  };
}
