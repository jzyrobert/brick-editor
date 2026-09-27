import { type Project, ensure, AppError } from "../core/types";
import { sha256 } from "../core/hash";
import { validate } from "../core/validate";
import { validateDocument } from "../core/document";
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}
export class LocalProjects {
  constructor(private storage: StorageAdapter) {}
  private prefix(id: string) {
    return "brick-editor:" + encodeURIComponent(id) + ":";
  }
  async load(id: string) {
    const prefix = this.prefix(id),
      head = this.storage.getItem(prefix + "head"),
      keys = Array.from(
        { length: this.storage.length },
        (_, i) => this.storage.key(i)!,
      ).filter((k) => k?.startsWith(prefix + "snapshot:"));
    const valid: Project[] = [];
    for (const key of [
      ...new Set(
        [head, ...keys].filter((k) =>
          k?.startsWith(prefix + "snapshot:"),
        ) as string[],
      ),
    ]) {
      try {
        const entry = JSON.parse(this.storage.getItem(key) || "null");
        if (entry && (await sha256(entry.json)) === entry.hash) {
          const p = JSON.parse(entry.json);
          validate("project", p);
          validateDocument(p);
          ensure(
            p.id === id,
            "INVALID_INPUT",
            "Snapshot belongs to a different project",
          );
          valid.push(p);
        }
      } catch {
        /* Try last known good snapshot. */
      }
    }
    return valid.sort((a, b) => b.revision - a.revision)[0] || null;
  }
  async save(p: Project, expectedStoredRevision: number | null) {
    const write = async () => {
      const previous = await this.load(p.id);
      ensure(
        (previous?.revision ?? null) === expectedStoredRevision,
        "REVISION_CONFLICT",
        "Another tab saved this project. Export a backup or fork it.",
      );
      if (previous) {
        ensure(
          p.revision >= previous.revision,
          "REVISION_CONFLICT",
          "Cannot replace a newer saved revision",
        );
        if (p.revision === previous.revision) {
          ensure(
            JSON.stringify(p) === JSON.stringify(previous),
            "REVISION_CONFLICT",
            "Saved revision has different content",
          );
          return p.revision;
        }
      }
      const prefix = this.prefix(p.id),
        key = prefix + "snapshot:" + p.revision + ":" + crypto.randomUUID(),
        json = JSON.stringify(p),
        envelope = JSON.stringify({ json, hash: await sha256(json) });
      try {
        this.storage.setItem(key, envelope);
        ensure(
          this.storage.getItem(key) === envelope,
          "STORAGE_QUOTA",
          "Snapshot verification failed",
        );
        this.storage.setItem(prefix + "head", key);
      } catch (e) {
        this.storage.removeItem(key);
        if (e instanceof AppError) throw e;
        throw new AppError(
          "STORAGE_QUOTA",
          "Browser save failed. Your build is still in memory; download a native backup.",
        );
      }
      const keys = Array.from(
        { length: this.storage.length },
        (_, i) => this.storage.key(i)!,
      )
        .filter((k) => k?.startsWith(prefix + "snapshot:"))
        .sort(
          (a, b) =>
            Number(b.slice((prefix + "snapshot:").length).split(":")[0]) -
            Number(a.slice((prefix + "snapshot:").length).split(":")[0]),
        );
      for (const old of keys.slice(2)) this.storage.removeItem(old);
      return p.revision;
    };
    if (typeof navigator !== "undefined" && navigator.locks)
      return navigator.locks.request("brick-editor-save:" + p.id, write);
    return write();
  }
  list() {
    return Array.from(
      { length: this.storage.length },
      (_, i) => this.storage.key(i)!,
    )
      .filter((k) => /^brick-editor:.+:head$/.test(k))
      .map((k) => decodeURIComponent(k.slice(13, -5)));
  }
}
