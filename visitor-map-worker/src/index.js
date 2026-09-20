const DATA_KEY = "geo_visits";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowList = (env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    allowList.includes("*") ? "*" : allowList.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

async function readData(env) {
  const raw = await env.VISITS.get(DATA_KEY);
  return raw ? JSON.parse(raw) : { total: 0, points: {} };
}

async function writeData(env, data) {
  await env.VISITS.put(DATA_KEY, JSON.stringify(data));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/track" && request.method === "GET") {
      const cf = request.cf || {};
      const data = await readData(env);
      data.total += 1;

      const lat = typeof cf.latitude !== "undefined" ? parseFloat(cf.latitude) : null;
      const lon = typeof cf.longitude !== "undefined" ? parseFloat(cf.longitude) : null;
      const city = cf.city || "Unknown";
      const country = cf.country || "??";

      if (lat !== null && lon !== null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
        const key = city + "|" + country;
        if (data.points[key]) {
          data.points[key].count += 1;
        } else {
          data.points[key] = { lat, lon, city, country, count: 1 };
        }
      }

      await writeData(env, data);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/map-data" && request.method === "GET") {
      const data = await readData(env);
      return new Response(
        JSON.stringify({ total: data.total, points: Object.values(data.points) }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404, headers });
  },
};
