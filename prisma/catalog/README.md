# Therapiekatalog

Referenzdaten der L&B-Behandlungs-Sammelmappe (übernommen aus `openspec/changes/iteration-2-treatments/reference/`, dort auch Herkunft und offene Punkte). `sync.mjs` spielt sie idempotent ein (`npm run catalog:sync`, im Migrationsjob über `prisma/migrate.sh`). `scales.json` beschreibt die Skalen des Bogens; die App prüft in einem Unit-Test, dass ihre Werte übereinstimmen.

`exercise-sheets.json` (Iteration 3, übernommen aus `openspec/changes/iteration-3-home-exercises/reference/`) nennt pro Übung Seite, Dateinamen von Hauptbild und Blatt, Schritt-Bezeichnungen und Zeitbedarf (`"TODO"` = noch nicht festgelegt). Die Texte der Blätter liest `sync.mjs` aus `exercises-content.json` im privaten Container `exercise-media` (lokal `STORAGE_EXERCISE_LOCAL_DIR`); fehlt die Datei, bleiben die gespeicherten Texte unverändert. Bilder und Texte von L&B liegen nie hier.
