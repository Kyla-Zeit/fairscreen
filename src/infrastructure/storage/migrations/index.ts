import { migrationV1 } from "./v1";
import { migrationV2 } from "./v2";
import type { DatabaseMigration } from "./types";

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  migrationV1,
  migrationV2,
];

export function applyDatabaseMigrations(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number,
): void {
  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.apply(database, transaction);
    }
  }
}
