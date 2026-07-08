import fs from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/env";
import type { StorageDriver } from "@/lib/storage";

/** Development-only local filesystem driver. Never used in production (see STORAGE_DRIVER). */
export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), getEnv().STORAGE_LOCAL_DIR);
  }

  private resolvePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error("Invalid storage key: path traversal detected");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }
}
