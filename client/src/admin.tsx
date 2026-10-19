import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { Booking, List, Property, User } from "../../shared/types";
import { amenities, ErrorBox, Load, money, send, useLoad } from "./shared";
export function Admin({ user }: { user: User | null }) {
  const [tab, setTab] = useState("properties");
  if (user?.role !== "admin")
    return (
      <div className="container section">
        <h1>Administrator access required</h1>
        <Link to="/login?next=/admin">Sign in with an admin account →</Link>
      </div>
    );
  return (
    <div className="container section">
      <p className="eyebrow">STAYFINDER MANAGEMENT</p>
      <h1>Admin workspace</h1>
      <div className="tabs">
        {["properties", "users", "bookings"].map((t) => (
          <button
            className={t === tab ? "" : "outline"}
            key={t}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "properties" ? (
        <Properties />
      ) : tab === "users" ? (
        <Users current={user} />
      ) : (
        <Bookings />
      )}
    </div>
  );
}
type PropertyForm = Omit<Property, "id" | "price_cents" | "currency"> & {
  id?: number;
  priceCents: number;
};
const blank: PropertyForm = {
  name: "",
  destination: "",
  description: "",
  priceCents: 11000,
  capacity: 2,
  amenities: ["WiFi"],
  images: [""],
  latitude: 0,
  longitude: 0,
  active: true,
};
function Properties() {
  const state = useLoad<List<Property>>("/admin/properties"),
    [editing, setEditing] = useState<PropertyForm | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  function edit(p: Property | null) {
    setError("");
    setEditing(p ? { ...p, priceCents: p.price_cents } : { ...blank });
  }
  function field<K extends keyof PropertyForm>(k: K, v: PropertyForm[K]) {
    setEditing(editing ? { ...editing, [k]: v } : null);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await send(
        "/admin/properties" + (editing.id ? "/" + editing.id : ""),
        editing,
        editing.id ? "PUT" : "POST",
      );
      setEditing(null);
      setMessage("Accommodation saved.");
      state.reload();
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={() => edit(null)}>Add accommodation</button>
      <ErrorBox error={error} />
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {editing && (
        <form className="admin-form" onSubmit={save}>
          <h2>{editing.id ? "Edit" : "Create"} accommodation</h2>
          <div className="form-grid">
            {(
              [
                ["name", "Name"],
                ["destination", "Destination"],
                ["priceCents", "Nightly price (USD cents)"],
                ["capacity", "Capacity"],
                ["latitude", "Latitude"],
                ["longitude", "Longitude"],
              ] satisfies [
                (
                  | "name"
                  | "destination"
                  | "priceCents"
                  | "capacity"
                  | "latitude"
                  | "longitude"
                ),
                string,
              ][]
            ).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  required
                  type={["name", "destination"].includes(k) ? "text" : "number"}
                  step={["latitude", "longitude"].includes(k) ? "any" : "1"}
                  value={editing[k]}
                  onChange={(e) =>
                    field(
                      k,
                      ["name", "destination"].includes(k)
                        ? e.target.value
                        : Number(e.target.value),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Description
            <textarea
              required
              value={editing.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <label>
            HTTPS image URLs (one per line)
            <textarea
              required
              value={editing.images.join("\n")}
              onChange={(e) => field("images", e.target.value.split("\n"))}
            />
          </label>
          <div className="amenities">
            {amenities.map((a) => (
              <label className="checkbox" key={a}>
                <input
                  type="checkbox"
                  checked={editing.amenities.includes(a)}
                  onChange={(e) =>
                    field(
                      "amenities",
                      e.target.checked
                        ? [...editing.amenities, a]
                        : editing.amenities.filter((x) => x !== a),
                    )
                  }
                />
                {a}
              </label>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => field("active", e.target.checked)}
            />
            Active — accepts new bookings
          </label>
          <div className="tabs">
            <button disabled={busy}>
              {busy ? "Saving…" : "Save accommodation"}
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => setEditing(null)}
            >
              Close editor
            </button>
          </div>
        </form>
      )}
      <Load state={state}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Destination</th>
                <th>Nightly price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.data?.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.destination}</td>
                  <td>{money(p.price_cents)}</td>
                  <td>{p.active ? "Active" : "Inactive"}</td>
                  <td>
                    <button className="outline small" onClick={() => edit(p)}>
                      Edit {p.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Load>
    </>
  );
}
function Users({ current }: { current: User }) {
  const state = useLoad<List<User>>("/admin/users"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await send("/admin/users", Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage("User created.");
      state.reload();
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function update(
    u: User,
    changes: Partial<Pick<User, "role" | "active">>,
  ) {
    setError("");
    setBusy(true);
    try {
      await send(
        "/admin/users/" + u.id,
        { active: u.active, role: u.role, ...changes },
        "PATCH",
      );
      setMessage("User updated.");
      state.reload();
    } catch (caught) {
      const e = caught as Error & { status?: number; code?: string };
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="admin-form" onSubmit={create}>
        <h2>Create user</h2>
        <div className="form-grid">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={10} required />
          </label>
          <label>
            Role
            <select name="role">
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <button disabled={busy}>Create user</button>
      </form>
      <ErrorBox error={error} />
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      <Load state={state}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={"Role for " + u.email}
                      disabled={busy || u.id === current.id}
                      value={u.role}
                      onChange={(e) =>
                        update(u, { role: e.target.value as User["role"] })
                      }
                    >
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.active ? "Active" : "Disabled"}</td>
                  <td>
                    <button
                      className="outline small"
                      disabled={busy || u.id === current.id}
                      onClick={() => update(u, { active: !u.active })}
                    >
                      {u.active ? "Disable" : "Enable"} {u.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Load>
    </>
  );
}
function Bookings() {
  const state = useLoad<List<Booking>>("/admin/bookings");
  return (
    <Load state={state}>
      {state.data?.items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "ID",
                  "Customer",
                  "Accommodation",
                  "Dates",
                  "Total",
                  "Status",
                  "Payment",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data!.items.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>
                    {b.customer_name}
                    <br />
                    {b.customer_email}
                  </td>
                  <td>{b.property_name}</td>
                  <td>
                    {b.check_in} → {b.check_out}
                  </td>
                  <td>{money(b.total_cents)}</td>
                  <td>{b.status}</td>
                  <td>{b.payment_status?.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="notice">There are no bookings yet.</p>
      )}
    </Load>
  );
}
