// Michael's request of 2026-11-21, item 2: the deploy tools refuse unless run from the checkout they deploy (tools/self-check.mjs). Tested on
// a temporary git repository (git reads only; nothing is deployed and no key file is involved).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { toolSelfCheck } from "../tools/self-check.mjs";

const git = (cwd: string, ...a: string[]) => {
  const r = spawnSync("git", a, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

function repo() {
  const root = mkdtempSync(join(tmpdir(), "selfcheck-"));
  const dir = join(root, "stacks", "cyrus");
  mkdirSync(join(dir, "tools"), { recursive: true });
  writeFileSync(join(dir, "tools", "tool.mjs"), "// a tool\n");
  git(root, "init", "-q");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "add", ".");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "tool");
  return { root, dir };
}

test("item 2: the checkout's own committed copy passes, and both hashes are printed equal", () => {
  const { root, dir } = repo();
  try {
    const r = toolSelfCheck(pathToFileURL(join(dir, "tools", "tool.mjs")).href, dir, "tool.mjs");
    assert.deepEqual(r.problems, []);
    assert.ok(r.blob.length === 40 && r.blob === r.committed);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("item 2: a copy run from anywhere else is refused, even with the same contents; a changed copy is refused on its contents too", () => {
  const { root, dir } = repo();
  const other = mkdtempSync(join(tmpdir(), "selfcheck-other-"));
  try {
    copyFileSync(join(dir, "tools", "tool.mjs"), join(other, "tool.mjs"));
    const same = toolSelfCheck(pathToFileURL(join(other, "tool.mjs")).href, dir, "tool.mjs");
    assert.equal(same.problems.length, 1);
    assert.match(same.problems[0]!, /run the tool from the checkout it deploys/);
    writeFileSync(join(other, "tool.mjs"), "// a changed tool\n");
    const changed = toolSelfCheck(pathToFileURL(join(other, "tool.mjs")).href, dir, "tool.mjs");
    assert.equal(changed.problems.length, 2);
    assert.match(changed.problems[1]!, /not the committed copy/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test("item 2: an uncommitted edit in the checkout's own copy, a tool not committed at HEAD, and a missing folder are refused", () => {
  const { root, dir } = repo();
  try {
    writeFileSync(join(dir, "tools", "tool.mjs"), "// edited in place\n");
    const edited = toolSelfCheck(pathToFileURL(join(dir, "tools", "tool.mjs")).href, dir, "tool.mjs");
    assert.deepEqual(edited.problems.length, 1);
    assert.match(edited.problems[0]!, /not the committed copy/);
    writeFileSync(join(dir, "tools", "new.mjs"), "// never committed\n");
    const uncommitted = toolSelfCheck(pathToFileURL(join(dir, "tools", "new.mjs")).href, dir, "new.mjs");
    assert.match(uncommitted.problems.join(" "), /not committed/);
    const gone = toolSelfCheck(pathToFileURL(join(root, "nowhere", "tool.mjs")).href, join(root, "nowhere"), "tool.mjs");
    assert.equal(gone.problems.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
