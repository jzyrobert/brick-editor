import { beforeAll, afterAll, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GenerationSession,
  evaluateFrozen,
  stageEvaluation,
  FINAL_NOTICE,
  type TextMessage,
} from "../../scripts/spatial-benchmark/session";
import {
  validateManifest,
  schedule,
  type Manifest,
} from "../../scripts/spatial-benchmark/manifest";
import {
  bundleCompiler,
  isolatedCompile,
  isolationProbe,
} from "../../scripts/spatial-benchmark/sandbox";
import { main } from "../../scripts/spatial-benchmark";
let root: string,
  worker: string,
  base: Manifest,
  n = 0;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "spatial-benchmark-"));
  worker = join(root, "compiler.mjs");
  await bundleCompiler(worker);
  base = validateManifest(
    JSON.parse(
      await readFile(
        "fixtures/spatial-benchmark/manifests/calibration.json",
        "utf8",
      ),
    ),
  );
}, 30000);
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
const valid = JSON.stringify({
  tool: "brick.build",
  input: {
    code: 'section("Fixture",[place({part:"3039",at:[0,0,0],colour:4}),place({part:"3024",at:[0,3,1],colour:4})]);',
    seed: 1,
  },
});
const invalid = JSON.stringify({
  tool: "brick.build",
  input: {
    code: 'section("Fixture",[place({part:"3039",at:[0,0,0],colour:4}),place({part:"3024",at:[0,0,0],colour:4})]);',
    seed: 1,
  },
});
async function replay(
  replies: string[],
  configure?: (m: Manifest) => void,
  historicalTurns = 0,
) {
  const m = structuredClone(base);
  configure?.(m);
  validateManifest(m);
  const c = schedule(m)[0],
    dir = join(root, `run-${n++}`);
  let calls = 0;
  const transcripts: TextMessage[][] = [];
  const session = new GenerationSession(
    m,
    c,
    dir,
    worker,
    async (r) => {
      transcripts.push([...r.messages]);
      const text = replies[calls++];
      if (text === undefined) throw new Error("transport exhausted");
      return text;
    },
    historicalTurns,
  );
  const frozen = await session.run();
  return { m, c, dir, session, frozen, transcripts, calls };
}
it("withholds all candidate results in no-feedback, freezes source before compiling and blocks re-entry", async () => {
  const attempt = JSON.stringify({
    check_build: { code: 'throw new Error("PRIVATE-DIAGNOSTIC")' },
  });
  const r = await replay([attempt, valid]);
  expect(r.frozen.status).toBe("submitted");
  expect(r.frozen.used.checks).toBe(0);
  expect(
    r.transcripts[1]
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(""),
  ).not.toContain("PRIVATE-DIAGNOSTIC");
  expect(await readFile(join(r.dir, "submission.txt"), "utf8")).toBe(valid);
  const audit = await readFile(join(r.dir, "audit.jsonl"), "utf8");
  expect(audit).toContain("generation-closed");
  expect(audit).not.toContain("private-check-result");
  await expect(r.session.run()).rejects.toThrow(/re-enter/);
  expect(await readdir(join(r.dir, "generation"))).toEqual(["input.txt"]);
}, 30000);
it("no-feedback retains an invalid final source and all failed scheduled cases", async () => {
  const r = await replay([invalid]);
  expect(r.frozen.status).toBe("model-failure");
  expect(r.calls).toBe(1);
  expect(await readFile(join(r.dir, "submission.txt"), "utf8")).toBe(invalid);
  expect(r.frozen.files["build.mpd"]).toBeDefined();
  const none = await replay([]);
  expect(none.frozen.status).toBe("infrastructure-failure");
  expect(none.frozen.files["submission.txt"]).toBeDefined();
});
it("blocks evaluator and native-tool routes and logs attempted access", async () => {
  const r = await replay(
    [
      JSON.stringify({
        tool: "read_file",
        input: { path: "fixtures/spatial-benchmark/evaluator/witnesses.json" },
      }),
      valid,
    ],
    (m) => {
      m.conditions[0].policy = "blind-mechanical";
      m.budgets.repairs = 1;
    },
  );
  expect(r.frozen.status).toBe("submitted");
  expect(r.transcripts[1].at(-1)?.content).toContain("Invalid protocol");
  expect(r.transcripts[1].at(-1)?.content).not.toContain("origins");
  expect(await readFile(join(r.dir, "audit.jsonl"), "utf8")).toContain(
    "read_file",
  );
});
it("repairs completed prose and concatenated JSON only within the run-wide budget", async () => {
  const repaired = await replay(
    ["<text>Invalid model response", valid],
    (m) => {
      m.conditions[0].policy = "blind-mechanical";
      m.budgets.repairs = 1;
    },
  );
  expect(repaired.frozen.status).toBe("submitted");
  expect(repaired.frozen.used.repairs).toBe(1);
  expect(repaired.transcripts[1].at(-1)?.content).toContain("Invalid protocol");
  const exhausted = await replay(
    [valid + "\n" + valid, "prose", valid],
    (m) => {
      m.conditions[0].policy = "blind-mechanical";
      m.budgets.repairs = 1;
    },
  );
  expect(exhausted.frozen.status).toBe("model-failure");
  expect(exhausted.frozen.used.repairs).toBe(1);
  expect(exhausted.calls).toBe(2);
});
it("answers a check beyond the budget once with a final-answer notice", async () => {
  const check = JSON.stringify({
    check_build: {
      code: 'section("Draft",[place({part:"3039",at:[0,0,0],colour:4})]);',
    },
  });
  const r = await replay([check, invalid, check, valid], (m) => {
    m.conditions[0].policy = "blind-mechanical";
    m.budgets.checks = 1;
    m.budgets.repairs = 1;
  });
  expect(r.frozen.used.checks).toBe(1);
  expect(r.frozen.used.repairs).toBe(1);
  expect(r.calls).toBe(4);
  expect(r.transcripts[3].at(-1)?.content).toBe(FINAL_NOTICE);
  expect(r.frozen.status).toBe("submitted");
  const again = await replay([check, check, check], (m) => {
    m.conditions[0].policy = "blind-mechanical";
    m.budgets.checks = 1;
  });
  expect(again.calls).toBe(3);
  expect(again.frozen.status).toBe("model-failure");
  expect(again.frozen.failure).toContain("Final brick.build required");
}, 30000);
it("continues a frozen case from its conversation and used budgets", async () => {
  const check = JSON.stringify({
    check_build: {
      code: 'section("Draft",[place({part:"3039",at:[0,0,0],colour:4})]);',
    },
  });
  const configure = (m: Manifest) => {
    m.conditions[0].policy = "blind-mechanical";
    m.budgets.checks = 1;
  };
  const first = await replay([check, valid], configure);
  const prompt = first.transcripts[0][0].content;
  const m = structuredClone(base);
  configure(m);
  const c = schedule(m)[0];
  const sent: TextMessage[][] = [];
  const session = new GenerationSession(
    m,
    c,
    join(root, `run-${n++}`),
    worker,
    async (r) => {
      sent.push([...r.messages]);
      return valid;
    },
  );
  const used = { ...first.frozen.used, turns: 1, checks: 1 };
  const frozen = await session.run({
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: check },
    ],
    used,
    message: FINAL_NOTICE,
  });
  expect(sent).toHaveLength(1);
  expect(sent[0]).toHaveLength(3);
  expect(sent[0].at(-1)?.content).toBe(FINAL_NOTICE);
  expect(frozen.status).toBe("submitted");
  expect(frozen.used.turns).toBe(2);
  expect(frozen.used.checks).toBe(1);
  await expect(
    new GenerationSession(
      m,
      c,
      join(root, `run-${n++}`),
      worker,
      async () => valid,
    ).run({
      messages: [{ role: "user", content: "different" }],
      used,
      message: FINAL_NOTICE,
    }),
  ).rejects.toThrow(/differs from the effective input/);
}, 30000);
it("enforces search and reference-volume budgets across invalid output repairs", async () => {
  const search = JSON.stringify({ parts_search: { query: "slope", limit: 1 } });
  const r = await replay([search, "invalid-json", search, valid], (m) => {
    m.conditions[0].policy = "blind-mechanical";
    m.budgets.searchCalls = 1;
    m.budgets.repairs = 1;
  });
  expect(r.frozen.used.searchCalls).toBe(1);
  expect(r.calls).toBe(3);
  expect(r.frozen.failure).toContain("searchCalls");
  const v = await replay([valid], (m) => {
    m.budgets.referenceBytes = 1;
  });
  expect(v.calls).toBe(0);
  expect(v.frozen.failure).toContain("referenceBytes");
});
it("honours prompt search replies without hidden inspection, turn or reference-volume caps", async () => {
  const info = JSON.stringify({
    part_info: {
      part_ids: Array(9).fill("3039"),
      fields: ["connectors"],
      limit: 1,
    },
  });
  const search = JSON.stringify({
    parts_search: [{ query: "slope", limit: 1 }],
  });
  const r = await replay(
    [...Array(9).fill(info), ...Array(11).fill(search), valid],
    (m) => {
      m.assistanceLimits = "prompt";
      m.conditions[0].policy = "blind-mechanical";
      m.conditions[0].facts = ["connectors"];
      m.conditions[0].exposure = "on-demand";
      m.budgets.searchCalls = 50;
      m.budgets.checks = 3;
      m.budgets.repairs = 2;
      m.budgets.infoCalls = 0;
      m.budgets.turns = 1;
      m.budgets.referenceBytes = 1;
    },
  );
  expect(r.frozen.status).toBe("submitted");
  expect(r.frozen.used.infoCalls).toBe(9);
  expect(r.frozen.used.turns).toBe(21);
  expect(r.frozen.used.searchReplies).toBe(10);
  expect(r.frozen.used.searchCalls).toBe(10);
  expect(r.transcripts[20].at(-1)?.content).toContain(
    "No search replies remain",
  );
  expect(r.frozen.used.referenceBytes).toBeGreaterThan(1);
}, 30000);
it("preserves historical denials before switching limits at a resumed request", async () => {
  const info = JSON.stringify({
    part_info: {
      part_ids: Array(9).fill("3039"),
      fields: ["connectors"],
      limit: 1,
    },
  });
  const r = await replay(
    [info, info, valid],
    (m) => {
      m.assistanceLimits = "prompt";
      m.conditions[0].policy = "blind-mechanical";
      m.conditions[0].facts = ["connectors"];
      m.conditions[0].exposure = "on-demand";
      m.budgets.searchCalls = 50;
      m.budgets.checks = 3;
      m.budgets.repairs = 2;
    },
    1,
  );
  expect(r.transcripts[1].at(-1)?.content).toContain(
    "part_info requires 1–8 IDs",
  );
  expect(r.transcripts[2].at(-1)?.content).not.toContain("Request denied");
  expect(r.frozen.status).toBe("submitted");
  expect(r.frozen.used.infoCalls).toBe(2);
}, 30000);
it("rejects a prompt contract with different check or repair allowances", () => {
  const m = structuredClone(base);
  m.assistanceLimits = "prompt";
  m.budgets.checks = 1;
  expect(() => validateManifest(m)).toThrow("Prompt assistance");
});
it("archives exact inspection requests/pages and blocks fields outside treatment", async () => {
  const info = JSON.stringify({
    part_info: {
      part_ids: ["3039"],
      fields: ["connectors"],
      offset: 0,
      limit: 2,
    },
  });
  const denied = JSON.stringify({
    part_info: { part_ids: ["3039"], fields: ["shape"] },
  });
  const r = await replay([info, denied, valid], (m) => {
    m.conditions[0].facts = ["connectors"];
    m.conditions[0].exposure = "on-demand";
  });
  const rows = (await readFile(join(r.dir, "audit.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  const payload = rows.find((r) => r.kind === "part_info").payload;
  expect(payload.request).toEqual(JSON.parse(info).part_info);
  expect(payload.bytes).toBe(Buffer.byteLength(payload.response));
  expect(JSON.parse(payload.response)[0].connectors.nextOffset).toBe(2);
  expect(r.transcripts[2].at(-1)?.content).toContain("outside treatment");
  expect(payload.response).not.toContain("physicalBounds");
});
it("evaluator gets copies, cannot revive a session, and source mutation is detected even on evaluator failure", async () => {
  const r = await replay([valid]);
  let calls = r.calls;
  await evaluateFrozen(r.dir, join(root, `eval-${n++}`), async (stage) => {
    await writeFile(join(stage, "submission.txt"), "MODIFIED COPY");
    await expect(r.session.run()).rejects.toThrow();
  });
  expect(r.calls).toBe(calls);
  expect(await readFile(join(r.dir, "submission.txt"), "utf8")).toBe(valid);
  const stage = join(root, `eval-${n++}`);
  await writeFile(
    join(r.dir, "freeze.json"),
    JSON.stringify({
      ...r.frozen,
      files: { ...r.frozen.files, "submission.txt": "wrong-hash" },
    }),
  );
  await expect(stageEvaluation(r.dir, stage)).rejects.toThrow(
    "Frozen artifact changed",
  );
});
it("isolates submitted JS from filesystem, credentials, network and native services", async () => {
  const good = await isolatedCompile(
    worker,
    {
      code: 'section("A",[place({part:"3001",at:[0,0,0],colour:4})]);',
      seed: 1,
    },
    20000,
    8000000,
  );
  expect(good.report?.stats.parts).toBe(1);
  for (const code of [
    "process.env",
    'require("node:fs").readFileSync("/etc/passwd")',
    'fetch("https://example.com")',
    '({}).constructor.constructor("return process")()',
  ]) {
    const out = await isolatedCompile(
      worker,
      { code, seed: 1 },
      10000,
      8000000,
    );
    expect(out.failure).toMatch(/not defined|Code generation/);
    expect(out.report).toBeUndefined();
  }
  const slow = await isolatedCompile(
    worker,
    { code: "while(true){}", seed: 1 },
    250,
    8000000,
  );
  expect(slow.failure).toContain("compute budget");
}, 30000);
it("CLI rejects forbidden image/resume/native options before creating output", async () => {
  for (const flag of [
    "--images",
    "--resume",
    "--revision",
    "--native-tools",
    "--gateway",
  ])
    await expect(
      main([flag, "blocked", "--out", join(root, "forbidden")]),
    ).rejects.toThrow(/Forbidden/);
});

it("the actual namespace excludes repository, evaluator, credentials and network routes", async () => {
  const probe = await isolationProbe(worker);
  expect(probe.denied).toHaveLength(6);
  expect(probe.env.sort()).toEqual(["PATH", "PWD"]);
  expect(probe.route.trim().split("\n")).toHaveLength(1);
  expect(probe.root).not.toContain("home");
  expect(probe.root).not.toContain("fixtures");
});

it("no-feedback does not return candidate syntax/seed repair information", async () => {
  const bad = JSON.stringify({
    tool: "brick.build",
    input: { code: "throw new Error('candidate error')", seed: 2 },
  });
  const r = await replay([bad, valid]);
  expect(r.calls).toBe(1);
  expect(r.frozen.status).toBe("model-failure");
  const audit = await readFile(join(r.dir, "audit.jsonl"), "utf8");
  expect(audit).not.toContain('"kind":"model-input"');
  expect(await readFile(join(r.dir, "submission.txt"), "utf8")).toBe(bad);
});

it("evaluator tampering with frozen source is detected after an evaluator exception", async () => {
  const r = await replay([valid]);
  await expect(
    evaluateFrozen(r.dir, join(root, `eval-${n++}`), async () => {
      await chmod(join(r.dir, "submission.txt"), 0o644);
      await writeFile(join(r.dir, "submission.txt"), "tampered");
      throw new Error("evaluator failed");
    }),
  ).rejects.toThrow("Frozen artifact changed");
});

it("enforces explicit exact counts only after closing no-feedback generation", async () => {
  const r = await replay([valid], (m) => {
    m.factsVersion = "spatial-part-facts/2";
    m.tasks[0].sizePolicy = "exact";
    m.tasks[0].targetParts = 3;
  });
  expect(r.calls).toBe(1);
  expect(r.frozen.status).toBe("model-failure");
  expect(r.frozen.files["build.mpd"]).toBeDefined();
  expect(r.frozen.used.repairs).toBe(0);
  const advisory = await replay([valid], (m) => {
    m.tasks[0].targetParts = 3;
  });
  expect(advisory.frozen.status).toBe("submitted");
});
it("returns bounded exact-count records in mechanical mode and preserves run-wide repair budget", async () => {
  const r = await replay([valid, valid], (m) => {
    m.factsVersion = "spatial-part-facts/2";
    m.tasks[0].sizePolicy = "exact";
    m.tasks[0].targetParts = 3;
    m.conditions[0].policy = "blind-mechanical";
    m.budgets.repairs = 1;
  });
  expect(r.calls).toBe(2);
  expect(r.frozen.status).toBe("model-failure");
  expect(r.frozen.used.repairs).toBe(1);
  expect(r.transcripts[1].at(-1)?.content).toContain(
    '"property":"exact-count"',
  );
});
it("serves corrected palette search and detailed v2 references with exact payload logging", async () => {
  const r = await replay(
    [
      JSON.stringify({ parts_search: { query: "slope", size: "2x2" } }),
      JSON.stringify({ part_info: { part_ids: ["3039"], fields: ["shape"] } }),
      valid,
    ],
    (m) => {
      m.factsVersion = "spatial-part-facts/2";
      m.conditions[0].facts = ["shape"];
    },
  );
  expect(r.frozen.status).toBe("submitted");
  expect(r.transcripts[1].at(-1)?.content).toContain(
    '"dimensionMeaning":"compiler-placement-reservation"',
  );
  expect(r.transcripts[2].at(-1)?.content).toContain(
    '"version":"spatial-part-facts/2"',
  );
  expect(await readFile(join(r.dir, "audit.jsonl"), "utf8")).toContain(
    "parts_search",
  );
});
