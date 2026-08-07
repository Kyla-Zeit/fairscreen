# Storage Infrastructure

M03 provides:

- native IndexedDB schema version 2, including repair of incomplete version-1 databases;
- the same typed repository contract in persistent and ephemeral modes;
- strict Zod parsing plus raw-data serialization guards;
- corrupt-record quarantine and future-version read-only recovery;
- atomic comparison saves and scoped deletion plans;
- a separate infrastructure-only recording Blob repository.

No repository is opened by public-page rendering. Later features opt in through
the domain port after an explicit workflow action.
