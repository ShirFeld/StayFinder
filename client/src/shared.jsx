import React, { useEffect, useState } from "react";
export const money = (c) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
export const amenities = [
  "WiFi",
  "Kitchen",
  "Pool",
  "Parking",
  "Air conditioning",
  "Pet friendly",
];
export async function api(url, options = {}) {
  const r = await fetch("/api" + url, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = r.status === 204 ? null : await r.json();
  if (!r.ok)
    throw new Error(data.error?.message || "Request failed. Please try again.");
  return data;
}
export const send = (url, body, method = "POST") =>
  api(url, { method, body: JSON.stringify(body) });
const localPhotos = new Set([
  "photo-1683623210055-b76c134c21bd",
  "photo-1600210492486-724fe5c67fb0",
  "photo-1600607687920-4e2a09cf159d",
  "photo-1613977257363-707ba9348227",
  "photo-1537996194471-e657df975ab4",
  "photo-1533105079780-92b9be482077",
  "photo-1555881400-74d7acaacd8b",
  "photo-1613395877344-13d4a8e0d49e",
]);
export function Photo({ src, alt, ...props }) {
  const id = src?.match(/photo-[a-z0-9-]+/)?.[0];
  const resolved =
    id === "photo-1533105079780-92b9be482077"
      ? "/images/photo-1683623210055-b76c134c21bd.jpg"
      : id === "photo-1613490493576-7fde63acd811"
        ? "/images/villa.jpg"
        : localPhotos.has(id)
          ? "/images/" + id + ".jpg"
          : src;
  return (
    <img
      src={resolved || "/stay-fallback.svg"}
      alt={alt}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/stay-fallback.svg";
      }}
      {...props}
    />
  );
}
export function ErrorBox({ error }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : null;
}
export function useLoad(url) {
  const [state, set] = useState({ loading: true, data: null, error: "" }),
    [version, refresh] = useState(0);
  useEffect(() => {
    let alive = true;
    set({ loading: true, data: null, error: "" });
    api(url)
      .then((data) => alive && set({ loading: false, data, error: "" }))
      .catch(
        (e) => alive && set({ loading: false, data: null, error: e.message }),
      );
    return () => {
      alive = false;
    };
  }, [url, version]);
  return { ...state, reload: () => refresh((v) => v + 1) };
}
export function Load({ state, children }) {
  if (state.loading)
    return (
      <p className="notice" role="status">
        Finding your next escape…
      </p>
    );
  if (state.error)
    return (
      <>
        <ErrorBox error={state.error} />
        <button onClick={state.reload}>Try again</button>
      </>
    );
  return children;
}
