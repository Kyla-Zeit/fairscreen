# Infrastructure Boundary

M03 implements native IndexedDB, matching ephemeral repositories, schema
validation, migrations, recording-blob isolation, and on-demand browser storage
estimation behind domain ports. Page and feature modules do not call IndexedDB
or browser storage APIs directly.
