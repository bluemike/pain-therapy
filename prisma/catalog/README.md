# Therapiekatalog

Referenzdaten der L&B-Behandlungs-Sammelmappe (übernommen aus `openspec/changes/iteration-2-treatments/reference/`, dort auch Herkunft und offene Punkte). `sync.mjs` spielt sie idempotent ein (`npm run catalog:sync`, im Migrationsjob über `prisma/migrate.sh`). `scales.json` beschreibt die Skalen des Bogens; die App prüft in einem Unit-Test, dass ihre Werte übereinstimmen.
