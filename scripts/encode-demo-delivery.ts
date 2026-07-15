import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const input = resolve(root, "packages/remotion/artifacts/demo/pitchflow-build-week-demo.mp4");
const output = resolve(root, "submission/demo/pitchflow-build-week-demo.mp4");
const reportPath = resolve(root, "submission/demo/pitchflow-build-week-demo-report.json");
const passDirectory = await mkdtemp(join(tmpdir(), "pitchflow-demo-delivery-"));
const passLog = join(passDirectory, "x264-pass");
const videoArguments = [
  "-map",
  "0:v:0",
  "-c:v",
  "libx264",
  "-profile:v",
  "high",
  "-preset",
  "slow",
  "-b:v",
  "4200k",
  "-maxrate",
  "5000k",
  "-bufsize",
  "10000k",
  "-pix_fmt",
  "yuv420p",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
];

async function fileHash(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

try {
  await mkdir(dirname(output), { recursive: true });
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      input,
      ...videoArguments,
      "-an",
      "-pass",
      "1",
      "-passlogfile",
      passLog,
      "-f",
      "null",
      process.platform === "win32" ? "NUL" : "/dev/null",
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      input,
      ...videoArguments,
      "-map",
      "0:a:0",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-pass",
      "2",
      "-passlogfile",
      passLog,
      "-movflags",
      "+faststart",
      "-metadata",
      "title=PitchFlow — OpenAI Build Week demo",
      "-metadata",
      "comment=Remotion master delivery encode; creator-owned UI; no music or third-party footage",
      output,
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );

  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_format", "-show_streams", "-of", "json", output],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const probe: unknown = JSON.parse(stdout);
  if (typeof probe !== "object" || probe === null || !("streams" in probe)) {
    throw new Error("FFprobe returned an invalid delivery report.");
  }
  const streams = (probe as { streams: Array<Record<string, unknown>> }).streams;
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!video || !audio) throw new Error("Delivery output must contain video and audio streams.");
  const durationSeconds = Number(video.duration);
  const [inputStat, outputStat, inputSha256, outputSha256] = await Promise.all([
    stat(input),
    stat(output),
    fileHash(input),
    fileHash(output),
  ]);
  if (outputStat.size >= 95_000_000) {
    throw new Error(`Delivery output is ${outputStat.size} bytes; expected less than 95 MB.`);
  }
  const report = {
    format: "pitchflow-build-week-demo-delivery",
    version: 1,
    source: {
      path: relative(root, input),
      bytes: inputStat.size,
      sha256: inputSha256,
      renderer: "Remotion",
    },
    outputPath: relative(root, output),
    reportPath: relative(root, reportPath),
    width: Number(video.width),
    height: Number(video.height),
    fps: video.avg_frame_rate === "30/1" ? 30 : Number.NaN,
    durationFrames: Number(video.nb_frames),
    durationSeconds,
    videoCodec: video.codec_name,
    videoProfile: video.profile,
    pixelFormat: video.pix_fmt,
    colorSpace: video.color_space,
    targetVideoBitrate: 4_200_000,
    actualVideoBitrate: Number(video.bit_rate),
    audioCodec: audio.codec_name,
    audioProfile: audio.profile,
    audioSampleRate: Number(audio.sample_rate),
    audioChannels: Number(audio.channels),
    audioBitrate: Number(audio.bit_rate),
    bytes: outputStat.size,
    sha256: outputSha256,
    music: null,
    thirdPartyFootage: false,
  };
  if (
    report.width !== 1920 ||
    report.height !== 1080 ||
    report.fps !== 30 ||
    report.durationFrames !== 4788 ||
    Math.abs(report.durationSeconds - 159.6) > 0.05 ||
    report.videoCodec !== "h264" ||
    report.videoProfile !== "High" ||
    report.pixelFormat !== "yuv420p" ||
    report.colorSpace !== "bt709" ||
    report.audioCodec !== "aac" ||
    report.audioSampleRate !== 48000 ||
    report.audioChannels !== 2
  ) {
    throw new Error("Delivery output does not match the Build Week media contract.");
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(passDirectory, { recursive: true, force: true });
}
