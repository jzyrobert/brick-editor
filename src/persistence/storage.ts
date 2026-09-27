import { type Project, ensure, AppError } from "../core/types";
import { sha256 } from "../core/hash";
import { validate } from "../core/validate";
import { validateDocument } from "../core/document";
import { encodeNative } from "./native";
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
  async list() {
    const ids = new Set<string>();
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      const match = key?.match(/^brick-editor:([^:]+):(?:head|snapshot:)/);
      if (match) {
        try {
          ids.add(decodeURIComponent(match[1]));
        } catch {
          /* Invalid foreign key. */
        }
      }
    }
    const result: {
      id: string;
      title: string;
      revision: number;
      approximateBytes: number;
    }[] = [];
    for (const id of ids) {
      const project = await this.load(id);
      if (project) {
        const prefix = this.prefix(id);
        let approximateBytes = 0;
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i)!;
          if (key.startsWith(prefix))
            approximateBytes +=
              (key.length + (this.storage.getItem(key)?.length || 0)) * 2;
        }
        result.push({
          id,
          title: project.title,
          revision: project.revision,
          approximateBytes,
        });
      }
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }
  async delete(id: string, expectedRevision: number) {
    const remove = async () => {
      const project = await this.load(id);
      ensure(
        project?.revision === expectedRevision,
        "REVISION_CONFLICT",
        "Saved project changed; refresh before deleting",
      );
      const prefix = this.prefix(id);
      const owned = Array.from(
        { length: this.storage.length },
        (_, i) => this.storage.key(i)!,
      ).filter((key) => key.startsWith(prefix));
      for (const key of owned) this.storage.removeItem(key);
    };
    if (typeof navigator !== "undefined" && navigator.locks)
      await navigator.locks.request("brick-editor-save:" + id, remove);
    else await remove();
  }
  async exportBackup(id: string) {
    const project = await this.load(id);
    ensure(project, "INVALID_INPUT", "Saved project is unavailable");
    return encodeNative(project);
  }
  async save(p: Project, expectedStoredRevision: number | null) {
    p = structuredClone(p);
    validate("project", p);
    validateDocument(p);
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
}
