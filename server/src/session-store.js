import session from "express-session";
import { db } from "./database.js";
export class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try {
      const row = db
        .prepare("SELECT data FROM sessions WHERE sid=? AND expires>?")
        .get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (e) {
      callback(e);
    }
  }
  set(sid, value, callback = () => {}) {
    try {
      db.prepare(
        "INSERT INTO sessions(sid,expires,data) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET expires=excluded.expires,data=excluded.data",
      ).run(
        sid,
        Date.now() + (value.cookie.maxAge || 86400000),
        JSON.stringify(value),
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }
  destroy(sid, callback = () => {}) {
    try {
      db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
      callback();
    } catch (e) {
      callback(e);
    }
  }
  touch(sid, value, callback = () => {}) {
    this.set(sid, value, callback);
  }
}
