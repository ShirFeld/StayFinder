// Only an opaque retry token is stored in this browser tab. Business data stays on the server.
const fallback = new Map();
const storageKey = (userId, propertyId, range) =>
  "stayfinder.checkout-request:" +
  JSON.stringify([
    userId,
    Number(propertyId),
    range.checkIn,
    range.checkOut,
    Number(range.guests),
  ]);
export function checkoutRequestKey(userId, propertyId, range) {
  const key = storageKey(userId, propertyId, range);
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const token = crypto.randomUUID();
    sessionStorage.setItem(key, token);
    return token;
  } catch {
    if (!fallback.has(key)) fallback.set(key, crypto.randomUUID());
    return fallback.get(key);
  }
}
export function forgetCheckoutRequest(userId, checkout) {
  const key = storageKey(userId, checkout.propertyId, checkout);
  try {
    sessionStorage.removeItem(key);
  } catch {}
  fallback.delete(key);
}
