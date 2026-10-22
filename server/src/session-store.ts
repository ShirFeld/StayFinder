import session from "express-session";
import { db } from "./database.ts";
import type { SessionRow } from "./types.ts";
export class SQLiteSessionStore extends session.Store {
  get(
    sid: string,
    callback: (error: unknown, session?: session.SessionData | null) => void,
  ) {
    try {
      const row = db
        .prepare<unknown[], SessionRow>(
          "SELECT data FROM sessions WHERE sid=? AND expires>?",
        )
        .get(sid, Date.now())!;
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (caught) {
      const e = caught as Error & { code?: string; type?: string };
      callback(e);
    }
  }
  set(
    sid: string,
    value: session.SessionData,
    callback: (error?: unknown) => void = () => {},
  ) {
    try {
      db.prepare(
        "INSERT INTO sessions(sid,expires,data) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET expires=excluded.expires,data=excluded.data",
      ).run(
        sid,
        Date.now() + (value.cookie.maxAge || 86400000),
        JSON.stringify(value),
      );
      callback();
    } catch (caught) {
      const e = caught as Error & { code?: string; type?: string };
      callback(e);
    }
  }
  destroy(sid: string, callback: (error?: unknown) => void = () => {}) {
    try {
      db.prepare<unknown[], SessionRow>("DELETE FROM sessions WHERE sid=?").run(
        sid,
      );
      callback();
    } catch (caught) {
      const e = caught as Error & { code?: string; type?: string };
      callback(e);
    }
  }
  touch(
    sid: string,
    value: session.SessionData,
    callback: (error?: unknown) => void = () => {},
  ) {
    this.set(sid, value, callback);
  }
}
