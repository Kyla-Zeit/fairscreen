export interface DatabaseMigration {
  readonly version: number;
  apply(database: IDBDatabase, transaction: IDBTransaction): void;
}
