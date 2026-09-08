import { mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LIMITS } from "../config";
import type { Debate, DebaterInfo, Speaker } from "../domain/types";
import { isTerminal } from "../domain/state-machine";

// OneDrive (and other sync clients) lock the temp file written for the atomic
// rename, so save() falls back to a direct write. We only warn about the
// fallback once per process — otherwise it spams the console on every save.
let renameFallbackWarned = false;

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
    // Drop any idle debates that have sat unstarted past the TTL before we
    // count the new one against the active cap (REVIEW C2: abandoned idle
    // creations must not wedge the API into a permanent 429).
    this.sweepIdle();
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

  /**
   * Removes a debate from the store entirely. Used to reclaim an `idle` debate
   * whose stream was opened then immediately closed (the client abandoned it
   * before the engine moved it off `idle`), and by `sweepIdle` for TTL expiry.
   * Only call this for debates that are not mid-run — removing a running debate
   * would orphan the engine's background `run()`.
   */
  delete(id: string): void {
    this.debates.delete(id);
    const filePath = path.join(this.dataDir, `${id}.json`);
    void unlink(filePath).catch(() => {
      // File may not exist (disk-lite persistence) or be mid-write; the in-memory
      // removal is what matters for the active-count cap.
    });
  }

  /**
   * Reclaims a debate whose stream was opened but abandoned by the client before
   * the engine moved it off `idle`. Returns true if it was removed. Centralises
   * the idle-reclaim policy (alongside `sweepIdle`) so HTTP adapters can signal
   * "client gone" without reaching into store state or knowing about `idle`.
   */
  reclaimIfIdle(id: string): boolean {
    const debate = this.debates.get(id);
    if (!debate || debate.stage !== "idle") return false;
    this.delete(id);
    return true;
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
        if (!renameFallbackWarned) {
          renameFallbackWarned = true;
          console.warn(
            `[store] atomic rename unavailable (likely a synced folder like OneDrive); ` +
              `falling back to direct writes for this session:`,
            (renameError as Error)?.message ?? renameError,
          );
        }
        await writeFile(filePath, contents, "utf8");
        // The rename left an orphaned temp file behind; clean it up so it does
        // not accumulate under the synced folder.
        await unlink(tempPath).catch(() => {});
      }
    } catch (error) {
      console.error(`[store] failed to persist debate ${debate.id}:`, error);
    }
  }

  activeCount(): number {
    this.sweepIdle();
    let count = 0;
    for (const debate of this.debates.values()) {
      if (!isTerminal(debate.stage)) count++;
    }
    return count;
  }

  /**
   * Reclaims `idle` debates that were created but never started within
   * `LIMITS.idleTtlMs`. A debate only leaves `idle` when its stream is opened,
   * so an abandoned POST (closed tab, network blip, probing bot) would otherwise
   * occupy a slot forever and, once enough accumulate, trip the permanent 429 in
   * POST /api/debates. Sweeping on access keeps the cap self-healing.
   */
  private sweepIdle(): void {
    const cutoff = Date.now() - LIMITS.idleTtlMs;
    for (const debate of this.debates.values()) {
      if (debate.stage !== "idle") continue;
      const created = Date.parse(debate.createdAt);
      if (Number.isFinite(created) && created <= cutoff) {
        this.delete(debate.id);
      }
    }
  }

  speakerOf(debate: Debate, speaker: Speaker): DebaterInfo {
    return speaker === "A" ? debate.debaterA : debate.debaterB;
  }
}
