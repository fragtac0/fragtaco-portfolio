import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Fields printed for a playlist or a video, one JSON object per line. */
export const FIELDS = "%(.{id,title,channel,channel_url,uploader_url,duration,upload_date,webpage_url})j";

const binary = (): string => {
  const candidate = process.env.YT_DLP ?? "/opt/homebrew/bin/yt-dlp";
  return existsSync(candidate) ? candidate : "yt-dlp";
};

/**
 * Runs yt-dlp with no account, no cookies and no configuration file, so it sends only what an anonymous
 * visitor would: its own generic browser user agent and the address asked for. Nothing about the owner.
 */
export const runYtDlp = async (args: string[]): Promise<string> => {
  const { stdout } = await exec(binary(), ["--ignore-config", "--no-cookies", "--no-warnings", "--skip-download", ...args], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
  });
  return stdout;
};
