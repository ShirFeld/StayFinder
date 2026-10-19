import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

test("database CLI migrates, seeds and requires confirmation before reset", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "stayfinder-ts-cli-"));
  const dbPath = path.join(directory, "cli.sqlite");
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("../src/database.ts", import.meta.url)),
        ...args,
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: {
          ...process.env,
          DOTENV_CONFIG_PATH: path.join(directory, "no-env"),
          DB_PATH: dbPath,
          NODE_ENV: "test",
          STRIPE_SECRET_KEY: "",
          STRIPE_WEBHOOK_SECRET: "",
        },
        encoding: "utf8",
        windowsHide: true,
      },
    );
  const counts = () => {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      return ["migrations", "users", "properties"].map(
        (table) =>
          db
            .prepare<[], { n: number }>(`SELECT count(*) n FROM ${table}`)
            .get()!.n,
      );
    } finally {
      db.close();
    }
  };
  try {
    const migration = run("migrate");
    assert.equal(migration.status, 0, migration.stderr);
    assert.match(migration.stdout, /migrate complete:/);
    assert.deepEqual(counts(), [4, 0, 0]);

    const seed = run("seed");
    assert.equal(seed.status, 0, seed.stderr);
    assert.match(seed.stdout, /seed complete:/);
    assert.deepEqual(counts(), [4, 3, 12]);
    assert.notEqual(run("seed").status, 0);

    const db = new Database(dbPath);
    try {
      db.prepare(
        "UPDATE users SET name='CLI regression probe' WHERE id=1",
      ).run();
    } finally {
      db.close();
    }
    const rejected = run("reset");
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Pass --confirm explicitly/);

    const inspect = new Database(dbPath, { readonly: true });
    try {
      assert.equal(
        inspect
          .prepare<[], { name: string }>("SELECT name FROM users WHERE id=1")
          .get()!.name,
        "CLI regression probe",
      );
    } finally {
      inspect.close();
    }

    const reset = run("reset", "--confirm");
    assert.equal(reset.status, 0, reset.stderr);
    assert.match(reset.stdout, /reset complete:/);
    assert.deepEqual(counts(), [4, 3, 12]);
    const restored = new Database(dbPath, { readonly: true });
    try {
      assert.equal(
        restored
          .prepare<[], { name: string }>("SELECT name FROM users WHERE id=1")
          .get()!.name,
        "Alex Morgan",
      );
    } finally {
      restored.close();
    }
  } finally {
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep),
    );
    assert.ok(path.basename(directory).startsWith("stayfinder-ts-cli-"));
    for (const file of readdirSync(directory))
      unlinkSync(path.join(directory, file));
    rmdirSync(directory);
  }
});
