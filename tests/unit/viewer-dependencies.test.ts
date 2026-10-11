import { expect, it } from "vitest";
import ts from "typescript";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

it("keeps native physics behind an asynchronous viewer boundary", () => {
  const visited = new Set<string>();
  const pending = [[resolve("src/main.tsx")]];
  const eagerPhysics: string[][] = [];
  while (pending.length) {
    const route = pending.shift()!;
    const file = route[route.length - 1];
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    source.forEachChild((node) => {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) return;
        if (
          clause &&
          !clause.name &&
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly)
        )
          return;
        specifier = node.moduleSpecifier;
      } else if (ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) return;
        if (
          node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.every((element) => element.isTypeOnly)
        )
          return;
        specifier = node.moduleSpecifier;
      }
      if (!specifier || !ts.isStringLiteral(specifier)) return;
      const name = specifier.text;
      if (name === "@dimforge/rapier3d-compat")
        eagerPhysics.push([...route, name]);
      if (!name.startsWith(".")) return;
      const base = resolve(dirname(file), name);
      const dependency = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
      ].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (dependency && /\.[jt]sx?$/.test(dependency))
        pending.push([...route, dependency]);
    });
  }
  expect(visited.size).toBeGreaterThan(100);
  expect(
    eagerPhysics,
    eagerPhysics.map((route) => route.join(" -> ")).join("\n"),
  ).toEqual([]);
});
