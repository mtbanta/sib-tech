// Michael's request of 2026-11-21 (item 2): the deploy-check tools live in the repo, committed and reviewed, and the version in the repo is
// the one used for every deploy. How that is enforced: each deploy tool must be run from the very checkout it deploys
// (node <dir>/tools/<tool>.mjs --dir <dir> ...). The tool already refuses unless that checkout is clean and at the reviewed commit, so the
// tool that runs is, byte for byte, the tool committed at the reviewed commit. This check refuses a copy run from anywhere else (the
// primary checkout, a temporary folder), and prints the tool's own git blob hash beside the committed one, for the deploy's log entry.
// Reads only (git). Never reads the key file. Paper only.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};

// `selfUrl`: the tool's import.meta.url. `dir`: the checkout's stacks/cyrus folder given as --dir. `name`: the tool's file name.
// Returns the problems (empty when the tool is the checkout's own copy) and the two hashes.
export function toolSelfCheck(selfUrl, dir, name) {
  const self = real(fileURLToPath(selfUrl));
  const expected = real(join(dir, "tools", name));
  const problems = [];
  if (!self || !expected || self !== expected) problems.push(`run the tool from the checkout it deploys: node ${join(dir, "tools", name)} --dir ${dir} ...`);
  const blob = self ? (spawnSync("git", ["hash-object", self], { encoding: "utf8" }).stdout || "").trim() : "";
  const committed = (spawnSync("git", ["-C", dir, "rev-parse", `HEAD:./tools/${name}`], { encoding: "utf8" }).stdout || "").trim();
  if (!blob || !committed || blob !== committed) problems.push(`the tool's contents (${blob.slice(0, 12) || "unknown"}) are not the committed copy at HEAD (${committed.slice(0, 12) || "not committed"})`);
  return { problems, blob, committed };
}
