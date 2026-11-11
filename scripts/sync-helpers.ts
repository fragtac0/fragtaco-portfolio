import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { VideosFileSchema } from "../app/content/schemas";
import type { SiteVideo } from "../app/types";

/**
 * The videos of the file already on disk, so the sync can keep what it could
 * not refresh. A missing file is a first run; an unreadable or invalid one is
 * reported, and the run goes on without a previous state.
 */
export const readPrevious = (
  file: string,
  warn: (message: string) => void = console.warn,
): SiteVideo[] => {
  if (!existsSync(file)) return [];
  try {
    const parsed = VideosFileSchema.safeParse(
      JSON.parse(readFileSync(file, "utf8")),
    );
    if (parsed.success) return parsed.data.items;
    warn(`Warning: ${file} does not match the schema, ignoring it for this run`);
  } catch (error) {
    warn(`Warning: ${file} is not readable JSON, ignoring it for this run (${String(error)})`);
  }
  return [];
};

/** Writes to `<file>.tmp`, then renames over `file`, so a crash never leaves half a file; a failed write removes the temp file. */
export const writeFileAtomic = (file: string, content: string): void => {
  const temp = `${file}.tmp`;
  try {
    writeFileSync(temp, content);
    renameSync(temp, file);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
};
