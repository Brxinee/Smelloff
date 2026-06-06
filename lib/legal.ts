import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "content", "legal");

/** Load a legal/policy page's markdown body (ported from the previous site). */
export function getLegalContent(slug: string): string {
  const file = path.join(DIR, `${slug}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
