const $ = (id) => document.getElementById(id);
const names = {
  control: "Control",
  shape: "Shape",
  connections: "Connections",
  combined: "Combined",
};
const views = ["Isometric", "Front", "Reverse isometric", "Back"];
let data,
  visible = [],
  active;
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
if (matchMedia("(max-width: 520px)").matches) $("filter-panel").open = false;
function render() {
  visible = data.cases.filter(
    (c) =>
      ["model", "condition", "subject"].every(
        (k) =>
          $(k).value === "all" ||
          c[k === "subject" ? "task" : k] === $(k).value,
      ) &&
      ($("failures").checked || c.valid),
  );
  $("count").textContent =
    `${visible.length} cases · ${visible.filter((c) => c.valid).length} compliant · ${visible.filter((c) => !c.valid).length} failed or noncompliant`;
  $("builds").replaceChildren();
  for (const task of data.tasks) {
    const cases = visible.filter((c) => c.task === task.id);
    if (!cases.length) continue;
    const group = el("section", undefined, "subject-group"),
      head = el("div", undefined, "subject-head"),
      grid = el("div", undefined, "build-grid");
    head.append(el("h2", task.name), el("span", `${cases.length} cases shown`));
    group.append(head);
    for (const c of cases) {
      const card = el("article", undefined, `build${c.valid ? "" : " failed"}`);
      card.dataset.case = c.id;
      const button = el(
        "button",
        undefined,
        c.images.length ? "build-shot" : "failure-body",
      );
      button.setAttribute(
        "aria-label",
        `Inspect ${task.name}, ${c.modelLabel}, ${names[c.condition]}, repeat ${c.rep}`,
      );
      if (c.images.length) {
        const img = el("img");
        img.src = c.images[Number($("view").value)];
        img.alt = `${task.name}, ${c.modelLabel}, ${names[c.condition]}, ${views[Number($("view").value)]}`;
        img.width = 1280;
        img.height = 960;
        img.loading = "lazy";
        img.decoding = "async";
        button.append(img, el("span", "Inspect case", "open-hint"));
      } else
        button.append(
          el("h3", "No compiled build"),
          el("p", c.status),
          el("span", "Inspect retained case"),
        );
      button.onclick = () => openDetail(c);
      card.append(button);
      const info = el("div", undefined, "build-info"),
        label = el("div", undefined, "build-label");
      label.append(
        el("span", `${c.modelLabel} · ${names[c.condition]}`),
        el("span", `Repeat ${c.rep}`, "rep"),
      );
      info.append(
        label,
        el(
          "p",
          `${c.status}${c.parts !== null ? ` · ${c.parts} parts` : ""}${c.score !== null ? ` · ${c.score}/24` : ""}`,
          "build-meta",
        ),
      );
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
        "No cases match. Shape-only and connector-only were tested only with Sol.",
        "empty",
      ),
    );
}
function openDetail(c) {
  active = c;
  const task = data.tasks.find((t) => t.id === c.task);
  $("detail-title").textContent =
    `${task.name} · ${c.modelLabel} · ${names[c.condition]} · Repeat ${c.rep}`;
  const content = $("detail-content");
  content.replaceChildren();
  const grid = el("div", undefined, "detail-views");
  c.images.forEach((src, i) => {
    const fig = el("figure"),
      img = el("img");
    img.src = src;
    img.alt = `${task.name}: ${views[i]}`;
    img.width = 1280;
    img.height = 960;
    fig.append(img, el("figcaption", views[i]));
    grid.append(fig);
  });
  content.append(grid);
  const summary = el("div", undefined, "detail-summary");
  summary.append(el("h3", c.status));
  if (c.reason) summary.append(el("p", c.reason));
  summary.append(el("h3", "Requested build"), el("p", task.brief));
  summary.append(
    el(
      "p",
      `${c.parts ?? "No"} compiled parts · No candidate feedback or repairs. Additional facts, where selected, were supplied automatically.`,
    ),
  );
  if (c.assessment) {
    summary.append(
      el(
        "h3",
        c.valid
          ? "Frozen automated assessment"
          : "Original assessment — excluded from compliant summaries",
      ),
    );
    summary.append(
      el(
        "p",
        `Unlabelled identification: ${c.assessment.recognition.guesses.join("; ")}. Original total: ${c.originalScore}/24.`,
      ),
    );
    const notes = el("ul");
    for (const note of c.assessment.assessment.observations)
      notes.append(el("li", note));
    summary.append(notes);
  } else
    summary.append(
      el(
        "p",
        "No visual score. Failed cases are not assigned an invented score.",
      ),
    );
  if (c.problems.length) {
    const list = el("ul");
    for (const p of c.problems)
      list.append(el("li", `${p.severity}: ${p.message}`));
    summary.append(el("h3", "Construction diagnostics"), list);
  }
  summary.append(
    el(
      "p",
      "Static checks do not certify stability, clutch strength or assembly order.",
    ),
  );
  const links = el("div", undefined, "downloads");
  for (const [name, href] of Object.entries(c.downloads)) {
    const a = el("a", `Download ${name}`);
    a.href = href;
    a.download = "";
    links.append(a);
  }
  summary.append(links);
  content.append(summary);
  const i = visible.indexOf(c);
  $("position").textContent = `${i + 1} / ${visible.length}`;
  $("previous").disabled = i === 0;
  $("next").disabled = i === visible.length - 1;
  if (!$("inspector").open) $("inspector").showModal();
  $("inspector").scrollTop = 0;
}
$("close").onclick = () => $("inspector").close();
for (const [id, delta] of [
  ["previous", -1],
  ["next", 1],
])
  $(id).onclick = () => {
    const next = visible[visible.indexOf(active) + delta];
    if (next) openDetail(next);
  };
for (const id of ["model", "condition", "subject", "view", "failures"])
  $(id).onchange = () => data && render();
fetch("data.json")
  .then((r) => {
    if (!r.ok) throw Error(r.status);
    return r.json();
  })
  .then((d) => {
    data = d;
    for (const t of data.tasks) $("subject").add(new Option(t.name, t.id));
    render();
  })
  .catch(() => {
    $("count").textContent = "Could not load results. Reload to retry.";
  });
