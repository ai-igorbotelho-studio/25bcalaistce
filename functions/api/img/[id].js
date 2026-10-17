/* GET /api/img/<id> — photos stored in D1. Content-addressed (the id is a
   hash of the bytes), so responses are cached at the edge forever and D1
   is only read once per photo per data centre. */
import { loadImage } from "../../../server/images.js";

export async function onRequestGet({ env, params, request, waitUntil }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Not found", { status: 404 });

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const img = await loadImage(env.DB, id);
  if (!img) return new Response("Not found", { status: 404 });
  const res = new Response(img.bytes, {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
