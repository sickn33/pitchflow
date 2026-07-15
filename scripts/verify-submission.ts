import { resolve } from "node:path";

import { verifySubmission } from "./submission-contract";

const root = resolve(process.cwd());
const allowGates = process.argv.includes("--allow-gates");
const result = await verifySubmission(root, { allowGates });

console.log(
  JSON.stringify(
    {
      format: "pitchflow-submission-verification",
      version: 1,
      allowGates,
      ...result,
    },
    null,
    2,
  ),
);

if (result.status === "failed") process.exitCode = 1;
