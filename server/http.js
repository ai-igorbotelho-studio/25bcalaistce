export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });

export const error = (status, message) => json({ error: message }, status);

/* An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* request.json() that never throws and always returns an object. */
export async function readBody(request) {
  try { const b = await request.json(); return b && typeof b === "object" ? b : {}; }
  catch { return null; }
}
