/**
 * 数据库模块
 * 提供 SQLite 数据库管理功能
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PSTEP_DB_PATH || `${__dirname}/../../data/pstep.db`;

let dbInstance: DatabaseType | null = null;

/**
 * 获取数据库实例
 */
export function getDatabaseManager(): DatabaseType {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    // 启用 WAL 模式提升并发性能
    dbInstance.pragma("journal_mode = WAL");
    // 初始化数据库表
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

/**
 * 初始化数据库表结构
 */
function initializeDatabase(db: DatabaseType): void {
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

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
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
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_session_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);
}

// 导出 DAO 模块
export * from "./dao.js";
