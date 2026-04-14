/**
 * SQLite 数据库模块
 *
 * 使用 Node.js 内置的 node:sqlite 模块存储用户存款记录。
 * 优点：数据持久化在服务器端，不因清除浏览器数据而丢失。
 * 无需安装原生依赖，跨平台兼容。
 */

// @ts-ignore - node:sqlite is experimental
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'earnflow.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  // 确保 data 目录存在
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  db.exec(`PRAGMA journal_mode = WAL`);

  // 创建存款记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      chainId INTEGER NOT NULL,
      vaultAddress TEXT NOT NULL,
      protocolName TEXT NOT NULL,
      vaultName TEXT NOT NULL,
      network TEXT NOT NULL,
      depositedAmountUsd REAL DEFAULT 0,
      tokenSymbol TEXT NOT NULL,
      tokenAmount TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deposit_records_address
    ON deposit_records(address);
  `);

  return db;
}

export interface DepositRecord {
  id: number;
  address: string;
  chainId: number;
  vaultAddress: string;
  protocolName: string;
  vaultName: string;
  network: string;
  depositedAmountUsd: number;
  tokenSymbol: string;
  tokenAmount: string;
  timestamp: number;
}

export function saveDepositRecord(record: Omit<DepositRecord, 'id'>): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO deposit_records
    (address, chainId, vaultAddress, protocolName, vaultName, network, depositedAmountUsd, tokenSymbol, tokenAmount, timestamp)
    VALUES (@address, @chainId, @vaultAddress, @protocolName, @vaultName, @network, @depositedAmountUsd, @tokenSymbol, @tokenAmount, @timestamp)
  `);
  stmt.run({
    address: record.address.toLowerCase(),
    chainId: record.chainId,
    vaultAddress: record.vaultAddress.toLowerCase(),
    protocolName: record.protocolName,
    vaultName: record.vaultName,
    network: record.network,
    depositedAmountUsd: record.depositedAmountUsd,
    tokenSymbol: record.tokenSymbol,
    tokenAmount: record.tokenAmount,
    timestamp: record.timestamp,
  });
}

export function getDepositRecordsByAddress(address: string): DepositRecord[] {
  const database = getDb();
  const stmt = database.prepare(
    'SELECT * FROM deposit_records WHERE address = ? ORDER BY timestamp DESC'
  );
  return stmt.all(address.toLowerCase()) as DepositRecord[];
}
