import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const scriptPath = join(root, "docs/DEMO_SCRIPT.md");
const outputDirectory = join(root, "submission/demo");
const transcriptPath = join(outputDirectory, "narration.txt");
const aiffPath = join(outputDirectory, "narration.aiff");
const audioPath = join(outputDirectory, "narration.m4a");
const reportPath = join(outputDirectory, "narration-report.json");
const voice = "Samantha";
const rateWordsPerMinute = 205;

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

const scriptData = await readFile(scriptPath);
const paragraphs = scriptData
  .toString("utf8")
  .split("\n")
  .filter((line) => line.startsWith("> "))
  .map((line) => line.slice(2).trim())
  .filter(Boolean);
if (paragraphs.length !== 7) {
  throw new Error(`Expected seven narrated demo sections, found ${paragraphs.length}.`);
}

const transcript = `${paragraphs.join("\n\n")}\n`;
const wordCount = transcript.split(/\s+/u).filter(Boolean).length;
if (wordCount < 350 || wordCount > 440) {
  throw new Error(`Narration word count ${wordCount} is outside the reviewed 350–440 range.`);
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(transcriptPath, transcript);
await rm(aiffPath, { force: true });
await rm(audioPath, { force: true });
await execFileAsync("say", [
  "--voice",
  voice,
  "--rate",
  String(rateWordsPerMinute),
  "--output-file",
  aiffPath,
  "--input-file",
  transcriptPath,
]);
await execFileAsync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  aiffPath,
  "-af",
  "highpass=f=70,lowpass=f=14000,loudnorm=I=-16:TP=-1.5:LRA=7",
  "-ar",
  "48000",
  "-ac",
  "1",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  audioPath,
]);

const { stdout } = await execFileAsync("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "format=duration",
  "-of",
  "json",
  audioPath,
]);
const probe: unknown = JSON.parse(stdout);
const durationSeconds =
  typeof probe === "object" &&
  probe !== null &&
  "format" in probe &&
  typeof probe.format === "object" &&
  probe.format !== null &&
  "duration" in probe.format &&
  typeof probe.format.duration === "string"
    ? Number(probe.format.duration)
    : Number.NaN;
if (!Number.isFinite(durationSeconds) || durationSeconds < 145 || durationSeconds > 170) {
  throw new Error(
    `Narration duration ${durationSeconds.toFixed(3)}s is outside the reviewed 145–170s window.`,
  );
}

const transcriptData = await readFile(transcriptPath);
const audioData = await readFile(audioPath);
const report = {
  format: "pitchflow-demo-narration",
  version: 1,
  language: "en-US",
  author: "Nicco Lucioli",
  script: relative(root, scriptPath),
  scriptSha256: sha256(scriptData),
  transcript: relative(root, transcriptPath),
  transcriptSha256: sha256(transcriptData),
  wordCount,
  voice: {
    engine: "macOS Speech Synthesis Manager",
    name: voice,
    aiAssisted: true,
    rateWordsPerMinute,
  },
  audio: {
    path: relative(root, audioPath),
    mediaType: "audio/mp4",
    codec: "AAC",
    channels: 1,
    sampleRate: 48_000,
    targetBitrate: 192_000,
    durationSeconds,
    bytes: audioData.byteLength,
    sha256: sha256(audioData),
  },
  music: null,
  thirdPartyFootage: false,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      status: "ok",
      report: relative(root, reportPath),
      wordCount,
      durationSeconds,
      audio: report.audio,
    },
    null,
    2,
  ),
);
