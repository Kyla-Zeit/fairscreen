import { migrationV1 } from "./v1";
import type { DatabaseMigration } from "./types";

/**
 * Repairs databases created by early development builds that used schema
 * version 1 before every object store and index was present. Re-applying the
 * idempotent v1 schema creation during the v2 upgrade fills in anything that
 * is missing without deleting user data.
 */
export const migrationV2: DatabaseMigration = {
  version: 2,
  apply(database, transaction) {
    migrationV1.apply(database, transaction);
  },
};
