/**
 * session-mapper — resolves (chatId, senderOpenId) → (projectId, sessionId).
 *
 * Resolution rules (in order):
 *  1. Static map from `FEISHU_CHAT_PROJECT_MAP` env var
 *     (format: "chatId1:projectId1,chatId2:projectId2")
 *  2. Otherwise: projectId = "feishu:<chatId>" (so the same chat always
 *     shares one project, with its own rules / history in the DB)
 *  3. sessionId = "<chatId>:<senderOpenId>" — same user in the same chat
 *     gets the same session; different users get different sessions within
 *     one chat. This is the right granularity for a multi-user group where
 *     each user has their own conversation thread.
 *
 * If the engine adapter wants different semantics (e.g. one session per
 * chat regardless of sender), it can override by mapping projectId /
 * sessionId itself before calling execute().
 */

export interface SessionMapping {
  projectId: string;
  sessionId: string;
}

export class SessionMapper {
  private readonly staticMap: Map<string, string>;

  constructor(envValue?: string) {
    this.staticMap = new Map();
    if (envValue) {
      for (const pair of envValue.split(",")) {
        const [chatId, projectId] = pair.split(":").map((s) => s?.trim());
        if (chatId && projectId) {
          this.staticMap.set(chatId, projectId);
        }
      }
    }
  }

  resolve(chatId: string, senderOpenId: string): SessionMapping {
    const projectId = this.staticMap.get(chatId) ?? `feishu:${chatId}`;
    const sessionId = `${chatId}:${senderOpenId}`;
    return { projectId, sessionId };
  }

  /** Inspect the static map (for logging / debugging) */
  get knownProjects(): Array<{ chatId: string; projectId: string }> {
    return Array.from(this.staticMap.entries()).map(([chatId, projectId]) => ({ chatId, projectId }));
  }
}
