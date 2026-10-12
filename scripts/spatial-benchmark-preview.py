#!/usr/bin/env python3
"""Assemble a static, public preview from frozen artifacts; no model calls."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def read(path):
    return json.loads(path.read_text())


def checked_copy(source, target, expected):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"Frozen file changed: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--creative-views", type=Path, required=True)
    parser.add_argument("--calibration-runs", type=Path, required=True)
    parser.add_argument("--calibration-views", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    study = root / "fixtures/spatial-benchmark/studies/sol-high-pilot"
    report = read(study / "creative-results.json")
    outcome = {r["caseId"]: r for r in read(study / "calibration-results.json")["results"]}
    titles = {"dragon": "Red dragon", "ewok": "Ewok", "pelican": "Pelican", "piplup": "Piplup", "temple": "Temple", "destroyer": "Star Destroyer", "slope-row": "Usable slope stud row", "arch-opening": "Clear arch opening", "body-contact": "Contact versus connection", "quarter-turn": "Quarter-turned extent", "slope-transfer": "Rotated slope connection"}
    conditions = ["control", "shape", "connections", "combined"]
    cases, tasks = [], []
    args.out.mkdir(parents=True, exist_ok=False)
    for stage, runs, views, manifest in [
        ("creative", study / "creative-cases", args.creative_views, read(study / "creative.json")),
        ("calibration", args.calibration_runs, args.calibration_views, read(study / "calibration.json")),
    ]:
        mapping = read(views / "private-mapping.json")
        expected = 72 if stage == "creative" else 40
        if len(mapping) != expected or len({r["caseId"] for r in mapping}) != expected:
            raise ValueError(f"Incomplete {stage} preview")
        for task in manifest["tasks"]:
            tasks.append({"stage": stage, "id": task["id"], "name": titles[task["id"]], "brief": task["brief"], "scheduled": 4 * manifest["repetitions"]})
        for row in mapping:
            case = row["caseId"]
            freeze = read(runs / case / "freeze.json")
            if row.get("renderFailure") or len(row["images"]) not in [0, 4]:
                raise ValueError(f"Incomplete render: {case}")
            stat = next((r for r in report["rows"] if r["caseId"] == case), None) if stage == "creative" else None
            record = {"id": case, "task": row["task"], "stage": stage, "condition": case.split("--")[-2], "rep": int(case.split("--")[-1]), "status": stat["status"] if stat else "submitted", "images": []}
            for image in row["images"]:
                relative = f"images/{stage}/{case}/{image['file']}"
                checked_copy(views / row["id"] / image["file"], args.out / relative, image["sha256"])
                record["images"].append(relative)
            if record["images"]:
                for name in ["compilation.json", "build.mpd"]:
                    data = (runs / case / name).read_bytes()
                    if hashlib.sha256(data).hexdigest() != freeze["files"][name]:
                        raise ValueError(f"Frozen artifact changed: {case}/{name}")
                compilation = read(runs / case / "compilation.json")
                relative = f"models/{stage}/{case}"
                record["mpd"], record["script"] = relative + ".mpd", relative + ".json"
                checked_copy(runs / case / "build.mpd", args.out / record["mpd"], freeze["files"]["build.mpd"])
                (args.out / record["script"]).write_text(json.dumps(compilation["script"]) + "\n")
                record["parts"] = compilation["report"]["stats"]["parts"]
                record["checks"], record["repairs"] = freeze["used"]["checks"], freeze["used"]["repairs"]
                record["inspections"] = stat["infoCalls"] if stat else outcome[case]["infoCalls"]
                if stat:
                    assessment = stat["visualAssessment"]
                    record.update(score=stat["visualTotal"], warnings=len(stat["problems"] or []), recognition=assessment["recognition"]["guesses"], observations=assessment["assessment"]["observations"], covered=stat["construction"]["covered"], uncovered=stat["construction"]["uncovered"])
                elif not outcome[case]["pass"]:
                    raise ValueError("Preview assumes the recorded calibration pass")
            cases.append(record)
    tasks.sort(key=lambda t: (t["stage"] != "creative", list(titles).index(t["id"])))
    cases.sort(key=lambda c: (c["stage"] != "creative", list(titles).index(c["task"]), c["rep"], conditions.index(c["condition"])))
    payload = {"version": "spatial-preview/1", "conditions": report["conditions"], "tasks": tasks, "cases": cases}
    (args.out / "data.json").write_text(json.dumps(payload, ensure_ascii=False) + "\n")
    for file in ["index.html", "style.css", "app.js"]:
        shutil.copyfile(root / "scripts/spatial-preview" / file, args.out / file)
    shutil.copyfile(root / "public/fonts/BricolageGrotesque.ttf", args.out / "BricolageGrotesque.ttf")
    shutil.copyfile(root / "public/notices/BRICOLAGE.txt", args.out / "FONT-LICENSE.txt")
    shutil.copyfile(study / "creative-results.json", args.out / "results.json")
    shutil.copyfile(root / "docs/SPATIAL-PILOT.md", args.out / "report.md")
    files = {str(p.relative_to(args.out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(args.out.rglob("*")) if p.is_file()}
    (args.out / "asset-hashes.json").write_text(json.dumps(files, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "builds": sum(bool(c["images"]) for c in cases), "images": sum(len(c["images"]) for c in cases), "out": str(args.out)}))


if __name__ == "__main__":
    main()
