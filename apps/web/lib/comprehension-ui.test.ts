import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  fileURLToPath(new URL("../components/workspace.tsx", import.meta.url)),
  "utf8",
);

const proposition =
  "Turn a GitHub repository into a launch website, social images, product videos, and";
const localCodexTruth =
  "PitchFlow reads the repository, uses your product screenshots for visual truth, and runs";

describe("five-second homepage comprehension contract", () => {
  it("states product, audience, input, outputs, power, and credential boundary explicitly", () => {
    for (const signal of [
      proposition,
      "For developers and open-source maintainers",
      "GitHub repository",
      "Optional screenshots and creative direction",
      localCodexTruth,
      "GPT‑5.6 through your local Codex account. Your credentials stay on your machine.",
      "Website",
      "Social images",
      "Product videos",
      "Copy",
      "ZIP",
    ]) {
      expect(workspaceSource).toContain(signal);
    }
  });

  it("keeps the hierarchy proposition then truth then one repository action then demo", () => {
    const heroStart = workspaceSource.indexOf("function ProductHero");
    const heroEnd = workspaceSource.indexOf("function ProductStepper", heroStart);
    const hero = workspaceSource.slice(heroStart, heroEnd);

    const propositionIndex = hero.indexOf(proposition);
    const truthIndex = hero.indexOf(localCodexTruth);
    const formIndex = hero.indexOf('className="pf-repo-form"');
    const primaryIndex = hero.indexOf("Create marketing assets");
    const demoIndex = hero.indexOf("Explore the PitchFlow demo");

    expect([propositionIndex, truthIndex, formIndex, primaryIndex, demoIndex]).toEqual(
      [...[propositionIndex, truthIndex, formIndex, primaryIndex, demoIndex]].sort(
        (left, right) => left - right,
      ),
    );
    expect(hero.match(/<form className="pf-repo-form"/g)).toHaveLength(1);
    expect(hero.match(/type="submit"/g)).toHaveLength(1);
    expect(hero.match(/className="pf-demo-action"/g)).toHaveLength(1);
    expect(hero).not.toContain("whole launch kit");
    expect(hero).not.toContain("AI launch kit");
  });

  it("shows one compact input to process to outputs relationship", () => {
    const outputsStart = workspaceSource.indexOf("function ProductOutputs");
    const outputsEnd = workspaceSource.indexOf("function ProductAppHeader", outputsStart);
    const outputs = workspaceSource.slice(outputsStart, outputsEnd);

    expect(outputs.indexOf("01 · Input")).toBeLessThan(outputs.indexOf("02 · Process"));
    expect(outputs.indexOf("02 · Process")).toBeLessThan(outputs.indexOf("03 · Outputs"));
    expect(outputs).toContain('aria-label="Generated deliverables"');
  });
});
