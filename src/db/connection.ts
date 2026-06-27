/**
 * 数据库连接管理
 * 提供 SQLite 数据库连接实例
 */

import DatabaseConstructor from "better-sqlite3";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PSTEP_DB_PATH || `${__dirname}/../../data/pstep.db`;

let dbInstance: InstanceType<typeof DatabaseConstructor> | null = null;

/**
 * 获取数据库实例
 */
export function getDatabaseManager(): InstanceType<typeof DatabaseConstructor> {
  if (!dbInstance) {
    dbInstance = new DatabaseConstructor(DB_PATH);
    dbInstance.pragma("journal_mode = WAL");
    // 初始化数据库表结构
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

/**
 * 初始化数据库表结构
 */
export function initializeDatabase(db: InstanceType<typeof DatabaseConstructor>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      auto_generated INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      initial TEXT,
      description TEXT,
      soul_json TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      importance INTEGER DEFAULT 50,
      source TEXT DEFAULT 'manual',
      source_session_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  // 迁移：为已有 sessions 表添加 agent_id 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN agent_id TEXT REFERENCES agents(id)`);
  } catch {
    // 列已存在，忽略错误
  }

  // 迁移：为 memory_entries 表添加新字段（如果不存在）
  try {
    db.exec(`ALTER TABLE memory_entries ADD COLUMN agent_id TEXT REFERENCES agents(id)`);
  } catch {
    // 列已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE memory_entries ADD COLUMN importance INTEGER DEFAULT 50`);
  } catch {
    // 列已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE memory_entries ADD COLUMN source TEXT DEFAULT 'manual'`);
  } catch {
    // 列已存在，忽略错误
  }
}
