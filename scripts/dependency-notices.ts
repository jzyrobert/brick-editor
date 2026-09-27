import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const records = [];
const notices = [];
for (const [path, entry] of Object.entries<any>(lock.packages)) {
  if (!path || !existsSync(path + "/package.json")) continue;
  const pkg = JSON.parse(readFileSync(path + "/package.json", "utf8"));
  const licenseFile = readdirSync(path).find((f) =>
    /^licen[sc]e(?:\.|$)/i.test(f),
  );
  records.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license || entry.license || "REVIEW_REQUIRED",
    dev: !!entry.dev,
    integrity: entry.integrity,
    licenseFile: licenseFile ? path + "/" + licenseFile : null,
  });
  if (licenseFile)
    notices.push(
      `=== ${pkg.name}@${pkg.version} ===\n` +
        readFileSync(path + "/" + licenseFile, "utf8"),
    );
}
writeFileSync(
  "docs/dependency-audit.json",
  JSON.stringify(records, null, 2) + "\n",
);
writeFileSync("public/notices/DEPENDENCIES.txt", notices.join("\n\n"));
console.log(
  `${records.length} installed dependency records; ${records.filter((r) => r.license === "REVIEW_REQUIRED").length} unknown licences`,
);
