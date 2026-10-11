import { expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexChannel } from "../../scripts/spatial-benchmark/codex-channel";
import { hash } from "../../scripts/spatial-benchmark/part-reference";
import type { Quota } from "../../scripts/spatial-benchmark/codex-quota";
it.each([false, true])(
  "the isolated Codex client sends only approved inputs (evaluator images: %s)",
  async (withImages) => {
    const dir = await mkdtemp(join(tmpdir(), "brick-codex-"));
    await mkdir(join(dir, "generation"));
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3PMQ0AMAzAsPInvYLYYVWKESTzjhsd8KsBrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BbQHKU9LC7/CP1AAAAABJRU5ErkJggg==",
      "base64",
    );
    const imageFile = join(dir, "generation", "image-0.png");
    if (withImages) await writeFile(imageFile, image);
    const quota: Quota = {
      checkedAt: "test",
      ordinaryUsageAllowed: true,
      reached: false,
      weeklyRemaining: 51,
      windows: [{ usedPercent: 49, windowDurationMins: 10080, resetsAt: null }],
    };
    const text = '{"tool":"brick.build","input":{"code":"section(\"A\",[]);"}}';
    const message = {
      id: "msg_mock",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    };
    const response = {
      id: "resp_mock",
      object: "response",
      created_at: 1,
      status: "completed",
      model: "gpt-6.1-sol",
      output: [message],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };
    const events = [
      {
        type: "response.created",
        response: { ...response, status: "in_progress", output: [] },
      },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { ...message, status: "in_progress", content: [] },
      },
      {
        type: "response.content_part.added",
        item_id: message.id,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: "", annotations: [] },
      },
      {
        type: "response.output_text.delta",
        item_id: message.id,
        output_index: 0,
        content_index: 0,
        delta: text,
      },
      {
        type: "response.output_text.done",
        item_id: message.id,
        output_index: 0,
        content_index: 0,
        text,
      },
      { type: "response.output_item.done", output_index: 0, item: message },
      { type: "response.completed", response },
    ];
    let requests = 0;
    const actualRequests: unknown[] = [];
    const adapter = await codexChannel({
      dir,
      evaluationImages: withImages
        ? [{ file: imageFile, sha256: hash(image) }]
        : undefined,
      quota: async () => quota,
      notify: async () => {},
      credentials: async () => ({
        accessToken: "MOCK-NOT-A-CREDENTIAL",
        accountId: "mock",
      }),
      fetchImpl: (async (_url, init) => {
        requests++;
        actualRequests.push(JSON.parse(String(init?.body)));
        const selectedEvents =
          requests === 2
            ? [
                {
                  type: "response.completed",
                  response: {
                    ...response,
                    output: [
                      {
                        type: "function_call",
                        name: "read_file",
                        call_id: "forbidden",
                        arguments: "{}",
                      },
                    ],
                  },
                },
              ]
            : events;
        return new Response(
          selectedEvents
            .map((e) => "data: " + JSON.stringify(e) + "\n\n")
            .join(""),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }) as typeof fetch,
    });
    try {
      const reply = await adapter.channel({
        messages: [
          {
            role: "user",
            content: "APPROVED-TEXT-ONLY. Reply with the requested JSON.",
          },
        ],
        model: {
          id: "gpt-6.1-sol",
          effort: "high",
          sampling: { temperature: null, topP: null, seed: null },
        },
        maxOutputTokens: 16000,
        signal: AbortSignal.timeout(20000),
      });
      expect(reply.trim()).toBe(text);
      expect(requests).toBe(1);
      expect(actualRequests[0]).toMatchObject({
        model: "gpt-6.1-sol",
        reasoning: { effort: "high" },
        tools: [],
        tool_choice: "none",
      });
      const payload = JSON.stringify(actualRequests[0]);
      expect(payload.includes("input_image")).toBe(withImages);
      const logged = await readFile(
        join(dir, "native", "transport.jsonl"),
        "utf8",
      );
      expect(logged).not.toContain("MOCK-NOT-A-CREDENTIAL");
      expect(logged).not.toContain("fixtures/spatial-benchmark");
      expect(logged).toContain("APPROVED-TEXT-ONLY");
      await expect(
        adapter.channel({
          messages: [{ role: "user", content: "SECOND APPROVED TEXT" }],
          model: {
            id: "gpt-6.1-sol",
            effort: "high",
            sampling: { temperature: null, topP: null, seed: null },
          },
          maxOutputTokens: 16000,
          signal: AbortSignal.timeout(20000),
        }),
      ).rejects.toThrow("Broker rejected turn");
      const after = await readFile(
        join(dir, "native", "transport.jsonl"),
        "utf8",
      );
      expect(after).toContain("denied-native-output");
      expect(after).not.toContain("MOCK-NOT-A-CREDENTIAL");
    } catch (e) {
      const stderr = await readFile(
        join(dir, "native", "turn-1.stderr.txt"),
        "utf8",
      ).catch(() => "(no stderr)");
      const wire = await readFile(
        join(dir, "native", "transport.jsonl"),
        "utf8",
      ).catch(() => "(no wire)");
      const stdout = await readFile(
        join(dir, "native", "turn-1.jsonl"),
        "utf8",
      ).catch(() => "(no stdout)");
      throw new Error(
        String((e as Error).message) +
          "\n" +
          stderr +
          "\n" +
          wire
            .split("\n")
            .filter(Boolean)
            .map((s) => {
              const r = JSON.parse(s);
              return r.kind;
            })
            .join(", ") +
          "\n" +
          stdout.slice(-5000),
      );
    } finally {
      await adapter.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
  30000,
);
