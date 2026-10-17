import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { config, serverRoot } from "./config.js";
mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
export function migrate() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  );
  for (const file of readdirSync(path.join(serverRoot, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (!db.prepare("SELECT 1 FROM migrations WHERE name=?").get(file)) {
      db.transaction(() => {
        db.exec(
          readFileSync(path.join(serverRoot, "migrations", file), "utf8"),
        );
        db.prepare("INSERT INTO migrations(name) VALUES(?)").run(file);
      }).immediate();
    }
  }
}
const photo = (id) =>
  "https://images.unsplash.com/" + id + "?auto=format&fit=crop&w=1400&q=85";
const places = [
  ["Lisbon", "Portugal", 38.7223, -9.1393, "photo-1555881400-74d7acaacd8b"],
  ["Santorini", "Greece", 36.3932, 25.4615, "photo-1613395877344-13d4a8e0d49e"],
  ["Bali", "Indonesia", -8.4095, 115.1889, "photo-1537996194471-e657df975ab4"],
  ["Lake Como", "Italy", 45.993, 9.257, "photo-1683623210055-b76c134c21bd"],
];
const interiors = [
  "photo-1613490493576-7fde63acd811",
  "photo-1600210492486-724fe5c67fb0",
  "photo-1600607687920-4e2a09cf159d",
  "photo-1613977257363-707ba9348227",
];
export function seed() {
  if (
    db.prepare("SELECT count(*) n FROM users").get().n ||
    db.prepare("SELECT count(*) n FROM properties").get().n
  )
    throw new Error(
      "Seed requires an empty database. Use the explicit reset command for practice data.",
    );
  db.transaction(() => {
    const insertUser = db.prepare(
      "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
    );
    for (const [name, email, role] of [
      ["Alex Morgan", "admin@stayfinder.demo", "admin"],
      ["Jamie Reed", "jamie@stayfinder.demo", "customer"],
      ["Taylor Park", "taylor@stayfinder.demo", "customer"],
    ])
      insertUser.run(name, email, bcrypt.hashSync("StayFinder123!", 12), role);
    const insert = db.prepare(
      "INSERT INTO properties(name,destination,description,price_cents,capacity,amenities,images,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,?)",
    );
    places.forEach(([city, country, lat, lon, picture], i) => {
      ["Hideaway", "Terrace House", "Garden Retreat"].forEach((type, j) => {
        insert.run(
          city + " " + type,
          city + ", " + country,
          "A thoughtfully furnished private " +
            (j === 0 ? "apartment" : j === 1 ? "villa" : "cottage") +
            " in " +
            city +
            ". Slow mornings, a fully equipped kitchen, comfortable bedrooms, and space to unwind after a day exploring. This listing represents one entire accommodation unit.",
          (110 + i * 45 + j * 35) * 100,
          2 + j * 2,
          JSON.stringify(
            j === 0
              ? ["WiFi", "Kitchen", "Air conditioning"]
              : j === 1
                ? ["WiFi", "Kitchen", "Pool", "Parking", "Air conditioning"]
                : ["WiFi", "Kitchen", "Parking", "Pet friendly"],
          ),
          JSON.stringify([
            photo(interiors[(i + j) % 4]),
            photo(picture),
            photo(interiors[(i + j + 1) % 4]),
          ]),
          lat,
          lon,
        );
      });
    });
  }).immediate();
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(serverRoot, "src", "database.js")
) {
  const command = process.argv[2];
  migrate();
  if (command === "reset") {
    if (!process.argv.includes("--confirm"))
      throw new Error(
        "Reset deletes practice data. Pass --confirm explicitly.",
      );
    db.transaction(() => {
      db.exec(
        "DELETE FROM sessions; DELETE FROM bookings; DELETE FROM checkouts; DELETE FROM properties; DELETE FROM users;",
      );
    }).immediate();
    seed();
  } else if (command === "seed") seed();
  else if (command !== "migrate")
    throw new Error("Use migrate, seed, or reset --confirm");
  console.log(command + " complete: " + config.dbPath);
  db.close();
}
