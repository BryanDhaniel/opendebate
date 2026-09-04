import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Debate, DebaterInfo, Speaker } from "../domain/types";
import { isTerminal } from "../domain/state-machine";

export interface CreateDebateInput {
  topic: string;
  debaterModel: string;
  judgeModel?: string;
}

export class DebateStore {
  private debates = new Map<string, Debate>();
  private dirReady = false;

  constructor(private dataDir: string) {}

  async create(input: CreateDebateInput): Promise<Debate> {
    const debaterA: DebaterInfo = { position: "FOR", model: input.debaterModel };
    const debaterB: DebaterInfo = {
      position: "AGAINST",
      model: input.debaterModel,
    };
    const debate: Debate = {
      id: randomUUID(),
      topic: input.topic,
      debaterA,
      debaterB,
      stage: "idle",
      transcript: [],
      research: {},
      createdAt: new Date().toISOString(),
    };
    this.debates.set(debate.id, debate);
    await this.save(debate);
    return debate;
  }

  get(id: string): Debate | undefined {
    return this.debates.get(id);
  }

  async save(debate: Debate): Promise<void> {
    this.debates.set(debate.id, debate);
    try {
      if (!this.dirReady) {
        await mkdir(this.dataDir, { recursive: true });
        this.dirReady = true;
      }
      const filePath = path.join(this.dataDir, `${debate.id}.json`);
      const tempPath = `${filePath}.tmp`;
      const contents = JSON.stringify(debate, null, 2);
      await writeFile(tempPath, contents, "utf8");
      try {
        await rename(tempPath, filePath);
      } catch (renameError) {
        // The atomic rename can fail under synced folders (e.g. OneDrive) or on
        // transient lock races, surfacing as ENOENT/EPERM on the temp file.
        // Fall back to a direct write so the debate is still persisted to disk
        // rather than silently dropped.
        console.warn(
          `[store] atomic rename failed for ${debate.id}, writing directly:`,
          renameError,
        );
        await writeFile(filePath, contents, "utf8");
      }
    } catch (error) {
      console.error(`[store] failed to persist debate ${debate.id}:`, error);
    }
  }

  activeCount(): number {
    let count = 0;
    for (const debate of this.debates.values()) {
      if (!isTerminal(debate.stage)) count++;
    }
    return count;
  }

  speakerOf(debate: Debate, speaker: Speaker): DebaterInfo {
    return speaker === "A" ? debate.debaterA : debate.debaterB;
  }
}
