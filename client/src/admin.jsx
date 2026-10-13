import React, { useState } from "react";
import { Link } from "react-router-dom";
import { send, money, amenities, ErrorBox, useLoad, Load } from "./shared";
export function Admin({ user }) {
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
const blank = {
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
  const state = useLoad("/admin/properties"),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  function edit(p) {
    setError("");
    setEditing(p ? { ...p, priceCents: p.price_cents } : { ...blank });
  }
  function field(k, v) {
    setEditing({ ...editing, [k]: v });
  }
  async function save(e) {
    e.preventDefault();
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
    } catch (e) {
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
            {[
              ["name", "Name"],
              ["destination", "Destination"],
              ["priceCents", "Nightly price (USD cents)"],
              ["capacity", "Capacity"],
              ["latitude", "Latitude"],
              ["longitude", "Longitude"],
            ].map(([k, label]) => (
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
function Users({ current }) {
  const state = useLoad("/admin/users"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await send("/admin/users", Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage("User created.");
      state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function update(u, changes) {
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
    } catch (e) {
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
            <input name="password" type="password" minLength="10" required />
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
                      onChange={(e) => update(u, { role: e.target.value })}
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
  const state = useLoad("/admin/bookings");
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
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.items.map((b) => (
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
