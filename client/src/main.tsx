import {
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
  Sun,
  Users,
  Waves,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type {
  Booking,
  Checkout,
  Destination,
  List,
  Property,
  PropertyList,
  Quote,
  User,
  Weather,
} from "../../shared/types";
import { ConfirmDialog, RouteFocus } from "./accessibility";
import { Admin } from "./admin";
import { CheckoutPage, paymentLabels, PendingCheckouts } from "./checkout";
import { checkoutRequestKey, forgetCheckoutRequest } from "./checkout-request";
import {
  amenities,
  api,
  ErrorBox,
  Load,
  money,
  Photo,
  send,
  useLoad,
} from "./shared";
import "./styles.css";
function App() {
  const currentLocation = useLocation();
  const signInTarget =
    currentLocation.pathname === "/login"
      ? "/login"
      : "/login?next=" +
        encodeURIComponent(currentLocation.pathname + currentLocation.search);
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("stayfinder:session-expired", expire);
    return () =>
      window.removeEventListener("stayfinder:session-expired", expire);
  }, []);
  useEffect(() => {
    if (user) setError("");
  }, [user?.id]);
  async function logout() {
    try {
      await send("/auth/logout");
      setUser(null);
      location.assign("/");
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    }
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header>
        <Link className="brand" to="/">
          <Waves />
          StayFinder<span>.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/stays">Explore stays</Link>
          {user && <Link to="/bookings">My bookings</Link>}
          {user?.role === "admin" && <Link to="/admin">Admin</Link>}
          {user ? (
            <button className="outline small" onClick={logout}>
              Sign out
            </button>
          ) : (
            <Link className="button small" to={signInTarget}>
              Sign in <ArrowRight size={15} />
            </Link>
          )}
        </nav>
      </header>
      <ErrorBox error={error} />
      <main id="main-content" tabIndex={-1}>
        {ready && <RouteFocus />}
        {ready ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stays" element={<Catalog />} />
            <Route path="/stays/:id" element={<Detail user={user} />} />
            <Route
              path="/login"
              element={<Login user={user} setUser={setUser} />}
            />
            <Route
              path="/bookings"
              element={
                user ? (
                  <Bookings />
                ) : (
                  <div className="container section">
                    <h1>Sign in to see your bookings</h1>
                    <Link to="/login?next=/bookings">Sign in →</Link>
                  </div>
                )
              }
            />
            <Route
              path="/checkout/:id"
              element={<CheckoutPage user={user} />}
            />
            <Route path="/admin" element={<Admin user={user} />} />
            <Route
              path="*"
              element={
                <div className="container section">
                  <h1>Page not found</h1>
                  <Link to="/">Back home</Link>
                </div>
              }
            />
          </Routes>
        ) : (
          <p role="status">Loading session…</p>
        )}
      </main>
      <footer>
        <Link className="brand" to="/">
          <Waves />
          StayFinder.
        </Link>
        <p>Somewhere new. Something unforgettable.</p>
        <span>Demo stays · USD · Built for exploring</span>
        <a href="/api/docs">API documentation ↗</a>
      </footer>
    </>
  );
}
function Search({ initial = {} }: { initial?: Record<string, string> }) {
  const navigate = useNavigate();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget))
      if (typeof v === "string" && v) query.set(k, v);
    navigate("/stays?" + query);
  }
  return (
    <form className="search-bar" onSubmit={submit}>
      <label>
        <span>WHERE TO?</span>
        <input
          name="destination"
          placeholder="City or destination"
          defaultValue={initial.destination || ""}
        />
      </label>
      <label>
        <span>CHECK IN</span>
        <input
          name="checkIn"
          type="date"
          defaultValue={initial.checkIn || ""}
        />
      </label>
      <label>
        <span>CHECK OUT</span>
        <input
          name="checkOut"
          type="date"
          defaultValue={initial.checkOut || ""}
        />
      </label>
      <label>
        <span>GUESTS</span>
        <input
          name="guests"
          type="number"
          min="1"
          max="50"
          defaultValue={initial.guests || 2}
        />
      </label>
      <button>
        Find a stay <ArrowRight size={18} />
      </button>
    </form>
  );
}
function Card({ p, query = "" }: { p: Property; query?: string }) {
  return (
    <article className="stay-card">
      <Link className="photo-link" to={"/stays/" + p.id + query}>
        <Photo src={p.images[0]} alt={p.name} />
        <span className="photo-tag">Entire place</span>
      </Link>
      <div className="card-body">
        <p className="location">
          <MapPin size={13} />
          {p.destination}
        </p>
        <Link to={"/stays/" + p.id + query}>
          <h3>{p.name}</h3>
        </Link>
        <p className="muted">
          Up to {p.capacity} guests · {p.amenities.slice(0, 2).join(" · ")}
        </p>
        <div className="card-bottom">
          <span>
            <strong>{money(p.price_cents)}</strong>{" "}
            <span className="muted">/ night</span>
          </span>
          <Link aria-label={"View " + p.name} to={"/stays/" + p.id + query}>
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
const destinationPhotos = [
  "photo-1537996194471-e657df975ab4",
  "photo-1683623210055-b76c134c21bd",
  "photo-1555881400-74d7acaacd8b",
  "photo-1613395877344-13d4a8e0d49e",
];
function Home() {
  const stays = useLoad<PropertyList>("/properties?pageSize=3"),
    dest = useLoad<List<Destination>>("/destinations");
  return (
    <>
      <section className="hero">
        <Photo
          className="hero-image"
          src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2200&q=85"
          alt="Sunlit villa beside a swimming pool"
        />
        <div className="hero-content">
          <p className="eyebrow light">A LITTLE FURTHER FROM THE EVERYDAY</p>
          <h1>
            Find your place.
            <br />
            <em>Make it a getaway.</em>
          </h1>
          <p>
            Beautiful spaces, memorable destinations.
            <br />
            Your next chapter starts with a stay.
          </p>
        </div>
        <div className="hero-search">
          <Search />
        </div>
      </section>
      <div className="trust-strip">
        <span>
          <ShieldCheck size={18} />
          Thoughtfully selected spaces
        </span>
        <span>
          <Users size={18} />
          Entire places, all yours
        </span>
        <span>
          <Sun size={18} />A change of scenery
        </span>
      </div>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FOLLOW YOUR CURIOSITY</p>
            <h2>Where will you wander?</h2>
            <p className="muted">From coastal mornings to city discoveries.</p>
          </div>
          <Link className="text-link" to="/stays">
            Explore all destinations →
          </Link>
        </div>
        <Load state={dest}>
          <div className="destination-grid">
            {dest.data?.items.map((d, i) => (
              <Link
                className="destination"
                key={d.destination}
                to={"/stays?destination=" + encodeURIComponent(d.destination)}
              >
                <Photo
                  src={
                    "https://images.unsplash.com/" +
                    destinationPhotos[i] +
                    "?auto=format&fit=crop&w=700"
                  }
                  alt={d.destination}
                />
                <div>
                  <h3>{d.destination.split(",")[0]}</h3>
                  <span>{d.count} places to call your own</span>
                </div>
              </Link>
            ))}
          </div>
        </Load>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STAY SOMEWHERE SPECIAL</p>
            <h2>Your next great escape</h2>
            <p className="muted">A few lovely places to get you dreaming.</p>
          </div>
          <Link className="text-link" to="/stays">
            View all stays →
          </Link>
        </div>
        <Load state={stays}>
          <div className="card-grid">
            {stays.data?.items.map((p) => (
              <Card p={p} key={p.id} />
            ))}
          </div>
        </Load>
      </section>
      <section className="escape-banner container">
        <div>
          <p className="eyebrow">LESS ROUTINE. MORE POSSIBILITY.</p>
          <h2>
            A weekend away.
            <br />A whole new perspective.
          </h2>
          <p>Pick a place. Pack a bag. Make time for yourself.</p>
          <Link className="button" to="/stays">
            Find your escape <ArrowRight size={17} />
          </Link>
        </div>
        <Waves size={140} strokeWidth={0.7} />
      </section>
    </>
  );
}
function Catalog() {
  const [params, setParams] = useSearchParams(),
    q = Object.fromEntries(params),
    state = useLoad<PropertyList>("/properties?" + params);
  function change(k: string, v: string | number) {
    const n = new URLSearchParams(params);
    if (v) n.set(k, String(v));
    else n.delete(k);
    n.delete("page");
    setParams(n);
  }
  function page(v: number) {
    const n = new URLSearchParams(params);
    n.set("page", String(v));
    setParams(n);
  }
  return (
    <div className="container section">
      <p className="eyebrow">MAKE YOURSELF AT HOME</p>
      <h1>Find your next escape</h1>
      <Search key={params.toString()} initial={q} />
      <div className="catalog">
        <aside className="filters">
          <h3>Refine your stay</h3>
          {[
            ["minPrice", "Minimum"],
            ["maxPrice", "Maximum"],
          ].map(([k, label]) => (
            <label key={k}>
              {label} price / night ($)
              <input
                type="number"
                min="0"
                value={q[k] ? Number(q[k]) / 100 : ""}
                onChange={(e) =>
                  change(
                    k,
                    e.target.value
                      ? Math.round(Number(e.target.value) * 100)
                      : "",
                  )
                }
              />
            </label>
          ))}
          <h4>Amenities</h4>
          {amenities.map((a) => (
            <label className="checkbox" key={a}>
              <input
                type="checkbox"
                checked={(q.amenities || "").split(",").includes(a)}
                onChange={(e) => {
                  const list = (q.amenities || "")
                    .split(",")
                    .filter(Boolean)
                    .filter((x) => x !== a);
                  if (e.target.checked) list.push(a);
                  change("amenities", list.join(","));
                }}
              />
              {a}
            </label>
          ))}
          <button className="outline" onClick={() => setParams({})}>
            Clear filters
          </button>
        </aside>
        <div>
          <div className="results-heading">
            <p>
              {state.data
                ? state.data!.total + " stays to discover"
                : "Explore our stays"}
            </p>
            <label>
              Sort by
              <select
                value={q.sort || "recommended"}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <Load state={state}>
            {state.data?.items.length ? (
              <>
                <div className="card-grid catalog-grid">
                  {state.data!.items.map((p) => (
                    <Card key={p.id} p={p} query={"?" + params} />
                  ))}
                </div>
                <nav className="pagination" aria-label="Search results pages">
                  <button
                    className="outline"
                    disabled={state.data!.page <= 1}
                    onClick={() => page(state.data!.page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {state.data!.page} of {state.data!.totalPages}
                  </span>
                  <button
                    className="outline"
                    disabled={state.data!.page >= state.data!.totalPages}
                    onClick={() => page(state.data!.page + 1)}
                  >
                    Next
                  </button>
                </nav>
              </>
            ) : (
              <div className="empty">
                <h3>No stays match your search</h3>
                <p>Try another destination, dates, or fewer filters.</p>
                <button onClick={() => setParams({})}>See all stays</button>
              </div>
            )}
          </Load>
        </div>
      </div>
    </div>
  );
}
function Weather({ id }: { id: string }) {
  const s = useLoad<Weather>("/weather?propertyId=" + id);
  return (
    <div className="weather">
      <Sun />
      <div>
        <strong>Weather at your destination</strong>
        {s.loading ? (
          <p role="status">Checking current weather…</p>
        ) : s.error ? (
          <p>Weather is unavailable. You can still book your stay.</p>
        ) : (
          <p>
            {s.data!.temperature}°C · Wind {s.data!.windSpeed} km/h
            <br />
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{" "}
            · {s.data!.time.replace("T", " ")}
          </p>
        )}
      </div>
    </div>
  );
}
function Detail({ user }: { user: User | null }) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    state = useLoad<Property>("/properties/" + id),
    [range, setRange] = useState({
      checkIn: params.get("checkIn") || "",
      checkOut: params.get("checkOut") || "",
      guests: params.get("guests") || 2,
    }),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const recovery = useLoad<List<Checkout>>(user ? "/checkouts" : null);
  const pending = recovery.data?.items.find(
    (c) =>
      c.propertyId === Number(id) &&
      c.checkIn === range.checkIn &&
      c.checkOut === range.checkOut &&
      c.guests === Number(range.guests) &&
      ["creating", "open"].includes(c.status),
  );
  const generation = useRef(0);
  const backToSearch = "/stays" + (params.size ? "?" + params.toString() : "");
  useEffect(() => {
    generation.current++;
    setRange({
      checkIn: params.get("checkIn") || "",
      checkOut: params.get("checkOut") || "",
      guests: params.get("guests") || 2,
    });
    setQuote(null);
  }, [params.toString()]);
  function update(k: string, v: string) {
    setRange({ ...range, [k]: v });
    setQuote(null);
    generation.current++;
    const next = new URLSearchParams(params);
    if (v !== "") next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setError("");
  }
  async function check(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setQuote(null);
    const currentGeneration = ++generation.current;
    try {
      const result = await api<Quote>(
        "/properties/" +
          id +
          "/availability?" +
          new URLSearchParams({ ...range, guests: String(range.guests) }),
      );
      if (currentGeneration === generation.current) setQuote(result);
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      if (currentGeneration === generation.current) setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function book() {
    setBusy(true);
    setError("");
    try {
      const checkout = await api<Checkout>("/checkouts", {
        method: "POST",
        headers: {
          "Idempotency-Key": checkoutRequestKey(user!.id, id!, range),
        },
        body: JSON.stringify({
          propertyId: Number(id),
          ...range,
          guests: Number(range.guests),
        }),
      });
      if (!["creating", "open"].includes(checkout.status))
        forgetCheckoutRequest(user!.id, checkout);
      if (checkout.checkoutUrl) window.location.assign(checkout.checkoutUrl);
      else window.location.assign("/checkout/" + checkout.id);
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
      setBusy(false);
    }
  }
  const p = state.data;
  return (
    <div className="container section">
      <Link className="text-link" to={backToSearch}>
        ← All stays
      </Link>
      <Load state={state}>
        {p && (
          <>
            <p className="location">
              <MapPin size={15} />
              {p.destination}
            </p>
            <h1>{p.name}</h1>
            <div className="gallery">
              {p.images.map((src, i) => (
                <Photo
                  src={src}
                  key={src + i}
                  alt={p.name + " — photo " + (i + 1)}
                />
              ))}
            </div>
            <div className="detail-layout">
              <section>
                <p className="eyebrow">YOUR OWN LITTLE CORNER OF THE WORLD</p>
                <h2>Settle in. Slow down.</h2>
                <p>{p.description}</p>
                <p>Entire accommodation · Up to {p.capacity} guests</p>
                <h3>What this place offers</h3>
                <div className="amenities">
                  {p.amenities.map((a) => (
                    <span key={a}>
                      <Check size={17} />
                      {a}
                    </span>
                  ))}
                </div>
                <Weather id={id!} />
              </section>
              <aside className="booking-panel">
                <h3>
                  {money(p.price_cents)} <small>/ night</small>
                </h3>
                <form onSubmit={check}>
                  <label>
                    Check in
                    <input
                      required
                      disabled={busy}
                      type="date"
                      value={range.checkIn}
                      onChange={(e) => update("checkIn", e.target.value)}
                    />
                  </label>
                  <label>
                    Check out
                    <input
                      required
                      disabled={busy}
                      type="date"
                      value={range.checkOut}
                      onChange={(e) => update("checkOut", e.target.value)}
                    />
                  </label>
                  <label>
                    Guests
                    <input
                      required
                      disabled={busy}
                      type="number"
                      min="1"
                      max={p.capacity}
                      value={range.guests}
                      onChange={(e) => update("guests", e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>
                    {busy ? "Please wait…" : "Check availability"}
                  </button>
                </form>
                <ErrorBox error={error} />
                {pending && (
                  <div className="notice" role="status">
                    <h3>You already have a checkout for these dates</h3>
                    <p>
                      Your dates are held. Resume it instead of starting another
                      payment.
                    </p>
                    <Link className="button" to={"/checkout/" + pending.id}>
                      Resume your checkout
                    </Link>
                  </div>
                )}
                {quote && !pending && (
                  <div className="quote">
                    <p>
                      {quote.nights} nights × {money(quote.nightlyPriceCents)}
                      <strong>{money(quote.totalCents)}</strong>
                    </p>
                    <p className="muted">USD · No additional fees</p>
                    {user ? (
                      <button disabled={busy} onClick={book}>
                        Continue to payment
                      </button>
                    ) : (
                      <Link
                        className="button"
                        to={
                          "/login?next=" +
                          encodeURIComponent(
                            "/stays/" + id + "?" + params.toString(),
                          )
                        }
                      >
                        Sign in to book
                      </Link>
                    )}
                  </div>
                )}
                <p className="muted fine">
                  Test payments only. Your dates are held temporarily when you
                  continue to Stripe. The booking is confirmed only after
                  payment succeeds.
                </p>
              </aside>
            </div>
          </>
        )}
      </Load>
    </div>
  );
}
function Login({
  user,
  setUser,
}: {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    navigate = useNavigate(),
    [params] = useSearchParams();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await send<{ user: User }>(
        "/auth/login",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setUser(d.user);
      const next = params.get("next");
      navigate(
        next?.startsWith("/") && !next.startsWith("//") ? next : "/stays",
      );
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <p className="eyebrow light">WELCOME TO YOUR NEXT CHAPTER</p>
        <h1>
          Good things
          <br />
          start with
          <br />
          <em>a getaway.</em>
        </h1>
      </div>
      <section className="login-form">
        <p className="eyebrow">WELCOME BACK</p>
        <h2>Make yourself at home.</h2>
        {user ? (
          <p>
            You are signed in as {user.name}.{" "}
            <Link to="/stays">Explore stays →</Link>
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <ErrorBox error={error} />
            <button disabled={busy}>
              {busy ? "Signing in…" : "Sign in"} <ArrowRight size={17} />
            </button>
          </form>
        )}
        <div className="demo">
          <strong>Try a demo account</strong>
          <p>
            Customer: jamie@stayfinder.demo
            <br />
            Admin: admin@stayfinder.demo
            <br />
            Password: StayFinder123!
          </p>
          <span>Sample accounts and listings for QA practice.</span>
        </div>
      </section>
    </div>
  );
}
function Bookings() {
  const state = useLoad<List<Booking>>("/bookings"),
    health = useLoad<{ today: string }>("/health"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [messageTone, setMessageTone] = useState("success"),
    [selected, setSelected] = useState<Booking | null>(null);
  async function cancel(id: number) {
    setBusy(id);
    setError("");
    try {
      const result = await send<Booking>("/bookings/" + id + "/cancel");
      setMessageTone(
        ["refund_pending", "refund_failed"].includes(result.payment_status)
          ? "warning"
          : "success",
      );
      setMessage(
        result.payment_status === "refunded"
          ? "Booking cancelled. Full test refund completed."
          : result.payment_status === "legacy"
            ? "Booking cancelled. No payment was taken for this older booking."
            : result.payment_status === "refund_failed"
              ? "Booking cancelled. The refund failed; use Retry refund."
              : "Booking cancelled. Full refund is awaiting Stripe confirmation; your dates have been released.",
      );
      setSelected(null);
      state.reload();
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="container section">
      <p className="eyebrow">ALL YOUR ADVENTURES, IN ONE PLACE</p>
      <h1>My bookings</h1>
      <PendingCheckouts />
      {selected && (
        <ConfirmDialog
          title="Cancel this booking?"
          confirmLabel={
            selected.payment_status === "legacy"
              ? "Confirm cancellation"
              : "Cancel and request full refund"
          }
          busy={busy === selected.id}
          onClose={() => {
            setSelected(null);
            setError("");
          }}
          onConfirm={() => cancel(selected.id)}
        >
          <p>
            <strong>{selected.property_name}</strong>
          </p>
          <p>
            {selected.check_in} to {selected.check_out} · {selected.guests}{" "}
            guests
          </p>
          <p>
            {selected.payment_status === "legacy"
              ? "No payment was taken for this older booking."
              : "Full test refund: " +
                money(selected.total_cents) +
                ". Refund confirmation may take longer if the provider is unavailable."}
          </p>
          <p>Cancelling releases your dates. This cannot be undone.</p>
          <ErrorBox error={error} />
        </ConfirmDialog>
      )}
      <ErrorBox error={error} />
      {message && (
        <p className={"notice " + messageTone} role="status">
          {message}
        </p>
      )}
      <Load state={state}>
        {state.data?.items.length ? (
          <div className="bookings">
            {state.data!.items.map((b) => (
              <article className="booking-card" key={b.id}>
                <Photo src={b.images[0]} alt={b.property_name} />
                <div>
                  <span className={"status " + b.status}>{b.status}</span>
                  <h3>{b.property_name}</h3>
                  <p>{b.destination}</p>
                  <p>
                    {b.check_in} → {b.check_out} · {b.guests} guests ·{" "}
                    {b.nights} nights
                  </p>
                  <strong>{money(b.total_cents)}</strong>
                  <p className="muted">
                    Confirmation #{b.id} · {money(b.nightly_price_cents)} per
                    night at booking
                  </p>
                  <p className="muted">
                    Payment:{" "}
                    {b.payment_status === "legacy"
                      ? "No payment (older booking)"
                      : paymentLabels[b.payment_status] ||
                        "Payment status unavailable"}
                  </p>
                  {b.status === "cancelled" &&
                    ["refund_pending", "refund_failed"].includes(
                      b.payment_status,
                    ) && (
                      <button
                        className="outline"
                        disabled={busy === b.id}
                        onClick={() => cancel(b.id)}
                      >
                        {busy === b.id ? "Checking refund..." : "Retry refund"}
                      </button>
                    )}
                  {b.status === "confirmed" &&
                  health.data &&
                  b.check_in > health.data.today ? (
                    <button
                      className="outline"
                      disabled={busy === b.id}
                      onClick={() => {
                        setError("");
                        setSelected(b);
                      }}
                    >
                      {busy === b.id
                        ? "Cancelling…"
                        : b.payment_status === "legacy"
                          ? "Cancel booking"
                          : "Cancel booking & full refund"}
                    </button>
                  ) : (
                    b.status === "confirmed" && (
                      <p className="muted">
                        Cancellation closes on check-in day.
                      </p>
                    )
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>No bookings yet</h2>
            <p>Your next escape is waiting.</p>
            <Link className="button" to="/stays">
              Explore stays
            </Link>
          </div>
        )}
      </Load>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
