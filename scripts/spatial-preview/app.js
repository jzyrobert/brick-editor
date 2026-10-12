const $ = (id) => document.getElementById(id);
const names = {
  control: "Control",
  shape: "Shape",
  connections: "Connections",
  combined: "Combined",
};
const views = ["Isometric", "Front", "Reverse isometric", "Back"];
if (matchMedia("(max-width: 520px)").matches) $("filter-panel").open = false;
let data,
  stage = "creative",
  visible = [],
  active = null;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function rebuildSubjects() {
  $("subject").replaceChildren(new Option("All subjects", "all"));
  for (const task of data.tasks.filter((t) => t.stage === stage))
    $("subject").add(new Option(task.name, task.id));
}
function render() {
  const subject = $("subject").value,
    condition = $("condition").value;
  visible = data.cases.filter(
    (c) =>
      c.stage === stage &&
      (subject === "all" || c.task === subject) &&
      (condition === "all" || c.condition === condition) &&
      ($("failures").checked || c.images.length),
  );
  const complete = visible.filter((c) => c.images.length).length;
  $("count").textContent =
    `${complete} completed builds${visible.length > complete ? ` · ${visible.length - complete} failed cases` : ""} shown`;
  $("stage-note").textContent =
    stage === "creative"
      ? "Four fixed views. Select a build to inspect it."
      : "40 / 40 passed. These two-part diagnostics are not creative-design scores.";
  $("builds").replaceChildren();
  for (const task of data.tasks.filter((t) => t.stage === stage)) {
    const cases = visible.filter((c) => c.task === task.id);
    if (!cases.length) continue;
    const group = el("section", undefined, "subject-group");
    const head = el("div", undefined, "subject-head");
    head.append(
      el("h2", task.name),
      el(
        "span",
        `${cases.filter((c) => c.images.length).length} builds / ${task.scheduled} scheduled`,
      ),
    );
    group.append(head);
    const grid = el("div", undefined, "build-grid");
    for (const c of cases) {
      const card = el(
        "article",
        undefined,
        `build${c.images.length ? "" : " failed"}`,
      );
      card.dataset.case = c.id;
      if (c.images.length) {
        const button = el("button", undefined, "build-shot");
        button.setAttribute(
          "aria-label",
          `Inspect ${task.name}, ${names[c.condition]}, repetition ${c.rep}`,
        );
        const img = el("img");
        img.src = c.images[Number($("view").value)];
        img.alt = `${task.name}, ${names[c.condition]}, repetition ${c.rep}, ${views[Number($("view").value)]} view`;
        img.width = 1280;
        img.height = 960;
        img.loading = "lazy";
        img.decoding = "async";
        button.append(img, el("span", "Inspect build", "open-hint"));
        button.addEventListener("click", () => openDetail(c));
        card.append(button);
      } else {
        const body = el("div", undefined, "failure-body");
        body.append(
          el("h3", "No compiled build"),
          el(
            "p",
            c.status === "model-failure"
              ? "The model exhausted its output-token budget before final submission."
              : "A provider or transport failure interrupted this case.",
          ),
        );
        card.append(body);
      }
      const info = el("div", undefined, "build-info"),
        label = el("div", undefined, "build-label");
      label.append(
        el("span", names[c.condition]),
        el("span", `Repeat ${c.rep}`, "rep"),
      );
      const meta = el("p", undefined, "build-meta");
      if (c.images.length) {
        meta.append(
          el(
            "span",
            stage === "creative" ? `${c.score} / 24` : "Calibration passed",
            "score",
          ),
        );
        meta.append(
          document.createTextNode(` · ${c.parts.toLocaleString()} parts`),
        );
        if (stage === "creative")
          meta.append(
            document.createTextNode(
              ` · ${c.warnings} warning${c.warnings === 1 ? "" : "s"}`,
            ),
          );
      } else
        meta.textContent =
          c.status === "model-failure"
            ? "Model budget failure · retained"
            : "Infrastructure failure · retained";
      info.append(label, meta);
      card.append(info);
      grid.append(card);
    }
    group.append(grid);
    $("builds").append(group);
  }
  if (!visible.length)
    $("builds").append(
      el(
        "p",
        "No cases match these filters. Choose another subject or include failed cases.",
        "empty",
      ),
    );
}
function openDetail(c) {
  active = c;
  const task = data.tasks.find((t) => t.stage === c.stage && t.id === c.task);
  $("detail-title").textContent =
    `${task.name} · ${names[c.condition]} · Repeat ${c.rep}`;
  const content = $("detail-content");
  content.replaceChildren();
  const grid = el("div", undefined, "detail-views");
  c.images.forEach((src, i) => {
    const figure = el("figure"),
      img = el("img");
    img.src = src;
    img.alt = `${task.name}: ${views[i]}`;
    img.width = 1280;
    img.height = 960;
    figure.append(img, el("figcaption", views[i]));
    grid.append(figure);
  });
  content.append(grid);
  const summary = el("div", undefined, "detail-summary");
  summary.append(el("h3", "Requested build"), el("p", task.brief));
  summary.append(
    el(
      "p",
      `${c.parts.toLocaleString()} compiled parts · ${c.checks} checks · ${c.repairs} repairs · ${c.inspections} completed fact inspections.`,
    ),
  );
  if (c.stage === "creative") {
    summary.append(
      el("h3", "Frozen automated assessment"),
      el(
        "p",
        `First unlabelled identification: ${c.recognition.join("; ")}. Visual total: ${c.score} / 24.`,
      ),
    );
    const list = el("ul");
    for (const note of c.observations) list.append(el("li", note));
    summary.append(list);
    summary.append(
      el("h3", "Construction coverage"),
      el(
        "p",
        `${c.warnings} warning records remain. ${c.covered.toLocaleString()} occurrences have supported connector data; ${c.uncovered.toLocaleString()} are uncovered. This does not verify stability, strength or assembly order.`,
      ),
    );
  } else
    summary.append(
      el(
        "p",
        "This build passed its declared geometric calibration relationships. Unsupported mechanical properties remain unverified; this is not a visual-design score.",
      ),
    );
  const links = el("div", undefined, "downloads");
  for (const [name, href] of [
    ["Download MPD", c.mpd],
    ["Download script", c.script],
  ]) {
    const a = el("a", name);
    a.href = href;
    a.download = "";
    links.append(a);
  }
  summary.append(links);
  content.append(summary);
  const builds = visible.filter((x) => x.images.length),
    index = builds.indexOf(c);
  $("position").textContent = `${index + 1} / ${builds.length}`;
  $("previous").disabled = index === 0;
  $("next").disabled = index === builds.length - 1;
  if (!$("inspector").open) $("inspector").showModal();
  $("inspector").scrollTop = 0;
}
for (const [id, delta] of [
  ["previous", -1],
  ["next", 1],
])
  $(id).addEventListener("click", () => {
    const builds = visible.filter((c) => c.images.length),
      next = builds[builds.indexOf(active) + delta];
    if (next) openDetail(next);
  });
$("close").addEventListener("click", () => $("inspector").close());
$("inspector").addEventListener("click", (event) => {
  if (event.target === $("inspector")) {
    const r = $("inspector").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      $("inspector").close();
  }
});
for (const id of ["subject", "condition", "view", "failures"])
  $(id).addEventListener("change", () => {
    if (data) render();
  });
for (const button of document.querySelectorAll("[data-stage]"))
  button.addEventListener("click", () => {
    if (!data) return;
    stage = button.dataset.stage;
    for (const b of document.querySelectorAll("[data-stage]"))
      b.setAttribute("aria-pressed", String(b === button));
    $("condition").value = "all";
    $("failures").checked = false;
    rebuildSubjects();
    render();
  });
fetch("data.json")
  .then((r) => {
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((value) => {
    data = value;
    for (const c of data.conditions) {
      const row = el("tr");
      for (const value of [
        names[c.id],
        `${c.submitted} / 18`,
        c.infrastructureFailures,
        c.modelFailures,
        `${c.inspectionRuns} / 18`,
        c.visualMean24.toFixed(2),
      ])
        row.append(el("td", String(value)));
      $("condition-table").append(row);
    }
    rebuildSubjects();
    render();
  })
  .catch(() => {
    $("count").textContent =
      "The results could not be loaded. Reload this page to try again.";
  });
