# CODEX START HERE — 360°-Horizont für Horizon Sunrise Analyzer

**Verbindlicher Entwicklungsauftrag (12.10.2026)**
**Repository:** https://github.com/gtowncity/horizon-sunrise-analyzer
**Arbeitsbranch:** feature/astro-360-horizon (bereits angelegt)
**Ausgangsversion:** 0.9.1; ursprünglicher main-Commit: 6b395610ceecaa8d0176432c697edfc384ae0823
**Produktionswebseite:** https://gtowncity.github.io/horizon-sunrise-analyzer/
**Freigabe:** Codeentwicklung ausschließlich auf Feature-Branch. Weder main verändern noch Production deployen oder PR mergen, bis der Nutzer dies ausdrücklich freigibt.

## 0. DEIN AUFTRAG: IMPLEMENTIEREN, NICHT NUR PLANEN

Du bist Codex und sollst den bestehenden wissenschaftlichen Web-Analyzer um einen neuen, vollwertigen, seriös validierten Analysereiter **360°-Horizont** für **ganz Bayern** erweitern. Das ist kein isolierter Demo-Prototyp. Entwickle den Code, die Oberfläche, Exportformate, Tests und vollständige Dokumentation im vorhandenen Repository; bewahre alle bestehenden Funktionen und deren Validierung. Arbeite eigenständig schrittweise, committe nachvollziehbar, melde Unsicherheiten sachlich und dokumentiere offene wissenschaftliche Grenzen. Jeder vollständig bearbeitete Entwicklungsauftrag muss mit einem überprüften Dokumentations- und Audit-ZIP enden (siehe §13).

Nutzerentscheidungen (bindend):
1. Neue, klar erkennbare Hauptnavigation: **Sichtlinie | Sonnenaufgang | 360°-Horizont**.
2. **Wichtigste Ergebnisgrafik:** breite, interaktive, flach abgewickelte 360°-Höhenkurve (Azimut 0–360° horizontal, Höhe in Grad vertikal). **Zwei synchronisierte Nebenansichten:** polare Himmelskuppel und Karte mit Hindernissen.
3. **Zwei wählbare Rechenmodi:** schneller Vorüberblick und deutlich aufwendigere Detailrechnung. Die Modi als Auswahlmöglichkeiten in einem gemeinsamen Reiter; Datenabdeckung/Unsicherheit niemals verschleiern.
4. Gesamtes Bayern als Anwendungsgebiet, nicht nur privater Aufnahmeort.
5. Exakte, reproduzierbare und wissenschaftlich redliche Auswertung samt Datennachweisen, Unsicherheit, Gegenproben, Testbericht und dokumentierter Versions-/Quellcodebasis.
6. Astronomy/N.I.N.A.-Export, 30° als **frei einstellbarer** Mindestwinkel (NICHT fester bundesweiter Standard).
7. **Vollständiges abschließendes ZIP** sämtlicher Dokumentation und Prüfergebnisse nach jeder Codex-Arbeitseinheit. Prüfe dessen Inhalt unabhängig, erzeuge SHA-256-Prüfsummen und biete das ZIP als herunterladbares CI-Artefakt an. Niemals privaten Beobachterstandort in öffentliche Artefakte übernehmen.

## 1. UNMITTELBAR ZUERST: KONKRETE CODEBASIS UND PFADHERKUNFT PRÜFEN

- Prüfe Repo-Remote und tatsächlich ausgecheckten Branch, git status und HEAD. Wechsle/erstelle den bestehenden Feature-Branch; niemals auf main schreiben.
- Ermittle den **wirklich vorhandenen absoluten Pfad** des aktuellen Codex-Checkouts, dokumentiere seine Herkunft (cloud/local/unknown).
- Suche den historischen lokalen Entwicklungsordner in wirklich vorhandenen Originalquellen, falls du Zugriff darauf hast: Astro Ultra Master Archiv 2026-10-10, historische Chat-Exporte, Projektmanifest, ggf. _local_audit. Ein früher in einem anderen Chat verwendeter Windows-Pfad ist **nicht bestätigt**. Falls nicht auffindbar: HISTORICAL_LOCAL_PATH_NOT_VERIFIED dokumentieren, keinen C:\-Pfad erfinden und ausschließlich im bestätigten Repo-Checkout weiterentwickeln. Frage den Nutzer NICHT nach einem Pfad, sofern das Repo sauber geklont/ausgecheckt werden kann.
- Startdateien: src/App.tsx, src/analysis.worker.ts, src/core/{engine,geo,types,solar,raster,export}.ts, src/data/{provider,batched-provider,cache}.ts und weitere TIFF-Module, src/components/{Map,Charts}.tsx, docs/, tests/, tests/reference/engine-v0.8.1.ts und .github/workflows/pages.yml.
- Bestandsaufnahme: Node 24; npm ci; npm run lint; npm run typecheck; npm test; npm run build; npx playwright install chromium; npm run test:e2e; npm audit --audit-level=high. Alle Befehle, Umgebungen, Exitcodes, Dauer, relevante Logs, bestanden/vorher-fehlgeschlagen vermerken. Änderungen erst nach diesem Vergleich.
- Vorhandene HSA-0.9.1-Sonnen- und Sichtlinienberechnungen unverändert korrekt halten. Falls gemeinsame Codebausteine verändert werden, exakte Regressionsvergleiche mit Referenzmodell durchführen.

## 2. WISSENSCHAFTLICHE DEFINITION

Gesucht ist die horizontbezogene Sichtfunktion H(A) für 0° <= A < 360° (wahrer geografischer Norden als 0°, im Uhrzeigersinn positiv). Für jede Richtung A ist H(A) das Maximum des sichtbaren Höhenwinkels über **alle tatsächlich untersuchten gültigen Boden- und Oberflächenhindernisse** im konfigurierten endlichen räumlichen Untersuchungsgebiet und für die ausgewählten Beobachterbedingungen.

Bisheriger Kern: proj4 EPSG:4326 -> EPSG:25832, WGS84 GeographicLib Geodäsie, GRS80-Normalschnittradius und k-basiertes terrestrisches Refraktionsmodell, DHHN2016-Normalhöhen und rasterkonformes PixelIsArea-Sampling. Verwende diesen Kern soweit mathematisch angemessen, statt ein minderwertiges zweites Modell zu bauen. Rechne astronomische Lichtbrechung NICHT als terrestrisches k. Diskutiere refraktive Szenarien statt behaupteter Echtzeitpräzision.

Daten:
- Amtliches **DGM1**: 1-m-Geländeraster ohne Gebäude/Vegetation; Produktgenauigkeit meist besser als ±0,20 m, lokal nicht garantiert.
- Amtliches **DOM20**: 0,2-m-Oberflächenraster aus Luftbildkorrelation; Gebäude/Vegetation im Erfassungszustand; erklärte Lage-/Höhenfehler ca. 0,4–0,6 m, nicht 0,2 m.
- Optional als voneinander unabhängige **Kontrollquellen**: bayerische LoD2-Dachmodelle und Laserpunktdaten/LAZ, soweit offiziell zugänglich, dokumentiert und effizient. Sie sind nicht automatisch präziser als DOM20.
- Alle Ausgangsdaten, Aufnahmedaten soweit nachweisbar, Dateihashes, Tile-IDs, API-/Downloadquellen und abgeleitete Daten korrekt kennzeichnen. Keine fiktiven Messwerte.

Wesentliche Fehlerquellen: Objektabstand und Messwinkel, unsicherer Beobachterpunkt, Höhe und Positionsänderung des optischen Eintrittspunkts, nahe Dachkanten, irdische Refraktion (k-Szenarien), Modell-/Rasterfehler, 0°/360°-Naht, NoData, unvollständige Tile-Abdeckung, endliche Distanz, fehlende/alte Bäume und Gebäude, unsichtbare schmale Hindernisse durch Azimut- oder Raum-Abtastung, vertikale Datumsbezüge (Normalhöhe vs ellipsoidisch). Unterschied zwischen numerical precision und physical accuracy explizit herausarbeiten.

**Nicht erlaubt:** „0.1°-Azimutraster mit 3600 Strahlen => vollständig und exakt.“ Entwickle stattdessen adaptive Winkel- und räumliche Verfeinerung unter expliziten Konvergenz-/Restfehlerkriterien; nutze Bounding-/Sektor-/Rasterzellverfahren, wo erforderlich. Unabgedeckte/ungenügend untersuchte Sektoren bekommen einen expliziten UNKNOWN/INCOMPLETE-Status. „Keine Hindernisse gemessen“ ist nicht gleich „freier Himmel“. Eine besonders exakte Einzelsichtlinie ist nicht gleich ein vollständiges 360°-Fächerprofil.

## 3. ZWEI BERECHNUNGSMODI IN EINEM REITER

**Modus A — Schnell / Übersicht:**
- Ressourcenbegrenzter Rundum-Scan; rasches Gelände-DGM-Profil und sinnvoll beschränkte, verfügbare DOM-Nahbereichsdaten.
- Grobe Vorauswertung mit gezielter adaptiver Verfeinerung. Jede Richtung meldet, was für Gelände/Oberfläche wirklich geprüft wurde; unberechnete DOM-Abschnitte niemals als vollständig darstellen.
- Benenne alle Ergebnisse mit Einschränkungen als VORLÄUFIG.

**Modus B — Detailliert / wissenschaftlich stärker:**
- Parametrisierte Distanz für Gesamtgelände plus separate DOM-Abdeckung, gegebenenfalls angrenzende Sektoren. Innerhalb des gewählten Bereichs bestmögliche vollständige Rasterprüfung, Peak-/Kanten-Erkennung, adaptive Winkelverfeinerung und echte Auswertungsgrenzen.
- Begrenzte Datenmengen, gekachelte native GeoTIFF-Blockabfragen, Caches, kontrollierter Speicher, Streaming, Abbruch/Wiederaufnahme soweit sinnvoll. Keine riesige naive 360° x DOM20 x 20km-Schleife, kein unbeschränkter Download.
- Überprüfe DGM1 + DOM20 und optional die unabhängigen 3D-Daten. Wo angefragte Daten/Fehlergrenzen im Browser nicht vollständig prüfbar sind, gib die DIREKTE begründete Grenze zurück, statt still eine „Detail vollständig“-Anzeige zu setzen.
- Echter Ressourcen-/Datenbedarfsindikator: anzufordernde Kacheln, Datenvolumen, gültige Abdeckung, Fortschritt, Unvollständigkeit, CORS- und Quotenfehler. Keine unbewiesenen Geschwindigkeitsschätzungen.

## 4. BENUTZEREINGABEN UND EINGABELOGIK

Einfach:
- Genaues Lat/Lon, Kopieren, Karte anklicken/Marker ziehen, Formatprüfung.
- Beobachterhöhe/Optikmittelpunkt über lokalem DGM1-Boden in m; automatisch berechnete Geländehöhe klar von optionaler absoluter Normalhöhe trennen.
- Modus Schnell/Detail; maximale Entfernung Gelände, Domänenbegrenzung für DOM; irdische Modelle für Gelände und Oberfläche; beliebiger Min-Höhenwinkel in Grad (beispielsweise 30°); optionale Sicherheitsreserve.
- Start / Abbrechen, verständliche Quellen-/Abdeckungsanzeige.

Erweitert:
- Positionsunsicherheit/Beobachtungsort-Radius, eingegebenes vertikales Genauigkeitsbudget, optionale gemessene Augen-Normalhöhe mit exaktem Referenzsystem; Höhe nicht doppelt addieren.
- Bei Teleskopen: möglicher Verschiebungs-/Höhenbereich des optischen Eintrittspunkts einschließlich Nachführung/Meridianflip (optional, kein verpflichtender EQ5-Wert).
- Abstandsbeschränkungen, Bereichsinstrumentierung, Azimut-/Distanzauflösung, Konvergenzkriterien, terrestrischer k-Parameter/Szenarien, Cache-Frische und ggf. Quellalter.
- Manuell vor Ort vermessene Dachkanten, Gebäude und Bäume als **separates belegtes** lokales Override-Layer mit Herkunft und Gültigkeitsbereich; niemals originale amtliche Raster manipulieren.
- Speicheroption für Standorte lokal und explizit, keine heimlichen Koordinaten in URL, Analyseanalytics, öffentlichem Test-/CI-Log oder Repo.

## 5. ERGEBNIS UND VISUALISIERUNG

**A — Primäre Vollbreiten-Grafik:** Höhe [°] über Azimut [°] 0..360 in wahrer Norddefinition. Zeige DGM1-Geländekurve, DOM20-Oberflächenkurve, effektiv/höchstbegrenzt, gewählten Mindestwinkel als getrennte Referenz und separat den Sicherheits-/Planungshorizont. Schraffierte/unbekannte Abschnitte bei fehlender Datenabdeckung. Zoom, verschiebbare Ansicht, Tooltip: Azimut, Winkel, Blockerentfernung, Blockerkoordinate, Datenquelle, Unsicherheit, Genauigkeits-/Abdeckungsstatus. Nord/Ost/Süd/West deutlich. Naht 0/360 nahtlos.

**B — Synchrone polare Himmelskuppel:** Norden oben, Osten rechts (reale Azimutkonvention ausdrücklich erklären), Zenit in der Mitte, 0° Höhe außen, konzentrische Höhenkreise, getrennte Zonen unter realem Horizont, unter Benutzer-Mindesthöhe und in ungeprüftem Bereich; Interaktion mit Hauptdiagramm verknüpft.

**C — Synchronisierte OSM-Karte:** Standort (privat), radialer Sektor, untersuchte Distanz, identifizierter Blocker mit Details, amtliche Hinderniskategorie; Marker und Kurven nur so zahlreich wie performant sinnvoll. Keine fotorealistische ausgedachte Panoramaansicht.

**D — Ergebnistabelle & wissenschaftlicher Status:** höchste/geringste Winkel, kritische Objekte/Entfernungen, kompletter vs. teilweiser Sektor, DGM-/DOM-Reichweite und Quellstand, ermittelte versus hypothetische Genauigkeit, Warnungen, Quellen und Einzelprüfungen. Mobile Darstellung, Tastatur, Kontrast, Diagrammexport, sorgfältige Einheiten.

## 6. ASTRO-NUTZUNG UND EXPORTE

- Definiere die tatsächliche berechnete physische H(A)-Kurve separat vom astronomischen nutzbaren Horizont: H_use(A) = max(H_actual(A) + verified/specified uncertainty margin, userMinAltitude). Margin darf nicht still als statistisches Konfidenzintervall behauptet werden.
- N.I.N.A.-Horizontdatei mit dokumentierter (und gegen aktuelle offizielle N.I.N.A.-Doku überprüfter) Syntax Azimut / Altitude. EXAKTES externes Format vor Veröffentlichung validieren; 0/360 Grad, Sortierung, Endpunkte/Interpolation, eventuelle Kommentare/Metadaten korrekt behandeln. Zwei getrennte Downloads: physischer Horizont und sicherer Nutzungs-/Planungshorizont; Export bei unbekanntem Korridor nicht als „sicher“ deklarieren.
- Vollständiges versionsgebundenes wissenschaftliches JSON (Originalkoordinaten, Eingaben, Quellen, Hashes soweit vorhanden, Coverage, Modellversion, Methoden, Warnungen, Winkelpunkte, Stützstellen) plus CSV (Spalten/Einheiten/Status) und saubere PNG/SVG-Grafik.
- Optional später Stellarium-Schnittstelle, erst nach verifizierter Formatspezifikation. Das Modul wird zukünftig mit Stern-/DSO-Bahnen, Dämmerung und kompletter Kamerasensor-FOV-Abdeckung verknüpft; **diese Erweiterung nicht als Voraussetzung** für den 360°-Release bauen.
- N.I.N.A. prüft typischerweise Zielposition und nicht alle Ecken des Kamerafeldes: Keine falsche Behauptung über garantierte freie DSO-Gesamtbildfläche.

## 7. SOFTWAREARCHITEKTUR

Kapsle die Funktion in src/features/horizon360/ mit klar getrenntem Daten-/Modell-/UI-/Exportbereich, gegebenenfalls neuem Worker und austauschbaren Rasterquellen. Teile ausschließlich bewährte Quell- und Geodäsiebausteine mit bestehender Software. Keine Solarberechnung als unnötige Abhängigkeit. Wo Rechenmotor geteilt wird, Vergleichstests der alten Resultate gegen Tests/Referenz durchführen.

Wünschenswert: kompakte Sector-Horizon-Repräsentation mit Annotations-/Coverage-/source-Provenance pro Segment; bedarfsgesteuerte Berechnung; typed arrays, native Blockabfragen und Speicherbudgets. Entkopple Darstellung (interpoliert/geglättet zur Visualisierung) von exportierter wissenschaftlicher Peak-Wahrheit. Änderungen an Sampling oder Glättung dürfen Gipfel/Schornsteine nicht unsichtbar machen.

Versioniere JSON-Schema ausdrücklich und baue reproduzierbares Import/Export-Schema mit Migration/Validierung. Nutze TypeScript/React/Vite/MapLibre/ECharts wie vorhandene App.

## 8. TESTMATRIX — VERBINDLICHE ABNAHMEN

**Math independent:** künstliche plane Fläche, Hügel, Grat, schmaler Schornstein, Hausdach, wechselnde DGM+DOM Höhen, NoData, negative Bereiche, gemischte Entfernungen, Koordinatenrand, Rasterkante, azimutnahe Naht, Refraktion/k-Szenario, Profilkonvergenz, nahes Gebäude mit Höhenfehler, mutierende Optikhöhe. Unabhängige Referenzwerte außerhalb der Produktionsfunktion berechnen; Fehler und Toleranzen begründen; keine „Tests passend machen“-Änderungen.

**Rasters & models:** PixelIsArea Zellmitten, DGM1/DOM20 EPSG25832, DHHN2016, ISO-Quellen, NoData/Tile-Seams, interpolierte Werte, Adaptivverfahren bei Kanten/extremen Peaks, gleiche Quelldateien und Hashes.

**Coverage & accuracy:** 360°-Naht, Lücken, räumliche und Winkelauflösung, remote data errors, gestaffelte Analyse, FAST vs DETAIL bei gleichem effektiven Datenumfang, manuelle Eingriffe mit Provenienz, getrennte Quelle+geprüft/ungeprüft Kennzeichnung, niemals Unknown=0. Verwende nur mathematisch gerechtfertigte Monotonie-Tests.

**Real data:** offizielle DGM1/DOM20-Tiles für mehrere unabhängige bayerische Referenzstellen, echte Download-/CORS-/Memory-Verifikation, Modellgegenproben und dokumentiertes wissenschaftliches Unsicherheitsbudget; private Standorte nicht veröffentlichen, nicht behaupten, dass On-Site-Messungen existieren, wenn nicht vorhanden. Wissenschaftliche Erkenntnisse von Fixierung der Implementierung trennen.

**Regressions:** alte Sichtlinie, Sonne, Rasterdownload, Caching, Worker-Abbruch, Charts, Kartenansicht und alte Exporte müssen bestehen; bestehende Referenzergebnisse exakt dort, wo die Ursprungsversion das garantiert. Playwright Desktop+Mobil, Tastatur/Barrierefreiheit, Fehlerzustände, ZIP-Export und Quelle.

**Performance:** ermittelte CPU-/Wandzeit, Tile-Zahlen, ZIP/GeoTIFF-Bytes und Metriken in unterschiedlichen Cachezuständen, Speicherprofile soweit messbar, Abbruch/Ressourcenlimits. Keine aus kleinen Proben unzulässig extrapolierten 360°-Speedup-Behauptungen.

Wenn Test scheitert: wissenschaftliche Abnahmesperre, präziser Bericht und ggf. begrenzter Folgefix; keinerlei „PASS“ ohne Belege.

## 9. DEPLOYMENT-SCHUTZ UND GIT

Die existierende Pages-Workflowdatei hat push auf main + pull_request + workflow_dispatch, Deploy-Job aktuell nur if event != pull_request. Achtung: manuelles workflow_dispatch eines Feature-Branches könnte versehentlich deployen. **Als erste sicherheitsrelevante Änderung** auf Feature-Branch sicherstellen, dass Upload/Deploy ausschließlich bei erlaubtem main-Ref UND erlaubtem Haupt-Event möglich ist. PR-Checks und separate Audit-Paketierung dürfen auf Feature-Branch laufen, niemals Live-Deployment.

Nutze verständliche Commit-Teilabschnitte; eröffne erst nach erfolgreicher Arbeit einen Draft-PR von feature/astro-360-horizon nach main. Nicht eigenmächtig mergen, production deployen, force-pushen oder Hauptbranch ändern. Publiziere keine privaten Standortkoordinaten oder privaten Astro-Archivinhalte.

## 10. ENTWICKLUNGSPHASEN — JEDE MIT EXIT-GATE

P0  Repo-/Baseline-/Pfad-Audit und unabhängige Testprotokolle.
P1  Wissenschaftliche Formalisierung, Accuracy/Coverage-Definitionen, Input-Schema, UI-Mockups und Architektur-ADRs vor Coding.
P2  DGM/DOM-360 Kern mit FAST/DETAIL, Coverage, Peak-Refinement, Cache-/Worker-Strategie und Basis-Tests.
P3  Hauptnavigation und 3 synchronisierte Ansichten inklusive mobile/keyboard/erreichbare UX.
P4  Wissenschaftlicher JSON/CSV/N.I.N.A.-Export, Messwert-/Horizon-Import und nachweisbare Format-Tests.
P5  Unabhängige Real-Daten-/Performance-/Regressionskontrolle, private Standorte ausschließen, Release-Blocker; Präzision ehrlich prüfen.
P6  Vollständige wissenschaftliche Dokumentation, PR-Review-Paket, reproduzierbar erstelltes Dokumentations-Audit-ZIP, unabhängige ZIP-Readbackkontrolle und Handoff.

Arbeite über mehrere Codex-Sitzungen, falls notwendig, mit permanentem Status-/Entscheidungs-/Fehlerregister im Feature-Branch. Am Ende einer Sitzung ZIP erzeugen; nie behaupten, ein langsamer oder unmöglicher realer Test sei bereits durchgeführt.

## 11. DOKUMENTATION: NICHT OPTIONAL

Erstelle unter docs/astro-360/ wenigstens:
- README.md / USER_GUIDE.md
- SCIENTIFIC_MODEL.md / FORMULAS_AND_UNITS.md
- DATA_SOURCES_AND_LICENSES.md / PROVENANCE.md
- UNCERTAINTY_BUDGET.md / VALIDATION_MATRIX.md
- RASTER_AND_SECTOR_COVERAGE.md / FAST_VS_DETAIL.md
- ARCHITECTURE.md / ADR-*.md
- UI_AND_VISUALIZATION.md / INPUT_SCHEMA.md
- EXPORT_FORMATS.md / NINA_COMPATIBILITY.md
- TEST_REPORT.md / REGRESSION_REPORT.md
- PERFORMANCE_REAL_DATA.md
- PRIVACY_AND_SECURITY.md
- DECISIONS_AND_ASSUMPTIONS.md
- OPEN_ISSUES_AND_LIMITATIONS.md
- CHANGELOG.md / HANDOFF.md

Jede Behauptung wissenschaftlicher Genauigkeit nur mit Formel, Quelle, unabhängigen Tests, realen Daten und Angabe, ob Toleranz/Näherung oder gemessene physische Genauigkeit. Historische Fakten und nicht-geprüfte Annahmen unterscheiden. Klare Fehlerklassifikation und Quellen-/Commit-Hashes. Die Dokumentation selbst ist Teil der Code-Reviews und Abnahmekriterien.

## 12. BEDINGUNGEN FÜR ERFOLG

Kein „fertig“, solange nicht alle drei Reiter korrekt funktionieren, beide auswählbaren 360-Modi ihre Abdeckung ehrlich kennzeichnen, ganze 360-Grafik/Polarkarte/OSM-Karte synchron sind, vollständige Exporte wissenschaftlich belegt sind, alte Ergebnisse unverändert sind, Fehler-/Performance-Szenarien dokumentiert sind und überprüfbare Tests existieren.

Wenn vollständige räumliche Genauigkeits- oder Browser-Ressourcengrenzen nicht lösbar sind, liefere den bestmöglichen funktionsfähigen Teil, kennzeichne Einschränkungen ausdrücklich, dokumentiere Folgeaufträge und melde den Status PARTIAL/BLOCKED statt fiktive Fertigstellung.

## 13. VERPFLICHTEND: ZIP-AUDIT AM ENDE JEDER CODEX-ARBEITSEINHEIT

Schreibe ein reproduzierbares Node-24-Paketierungsskript (beispielsweise scripts/package-astro-360-audit.mjs), GitHub-Actions-Upload für das ZIP (pull_request / nicht-deployendes manuelles CI) und automatische Readback-/Integritätstests. ZIP-Dateiname:
ASTRO360_CODEX_AUDIT_<UTC-TIMESTAMP>_<SHORT-COMMIT>.zip

Das ZIP enthält, jeweils mit Nachweis, mindestens:
1. vollständige aktuelle öffentliche Projektdokumentation und diesen Auftrag sowie AGENTS.md, README, Quellen, ADRs;
2. Git-Branch, Commit, git status, Liste geänderter Dateien, Diff-Statistik und maschinenlesbare Source-/SHA256-Manifeste;
3. Testbefehle/-versionen, Startzeit/Dauer, Exitcodes und vollständige relevante Test- und Build-Logs (lint, TS, Unit, E2E, npm audit);
4. unabhängige numerische Referenzrechnungen, Test-fixture-Provenienz, wissenschaftliche Fehlerbudgets und ungelöste offene Punkte;
5. echte Performancewerte, Quellen-Tiles mit Hashes soweit vorhanden, Diagramm-/UI-Screenshots soweit tatsächlich erstellt;
6. Verifikationsbericht, Known Gaps, Kontrollen auf Regression und Datenschutz;
7. README_FIRST + MACHINE_READABLE_VALIDATION_REPORT.json mit finaler PASS / PASS_WITH_KNOWN_GAPS / FAIL-Klassifikation.

**Integrität zwingend:** ZIP zunächst vollständig erzeugen und schließen; danach neu öffnen, tatsächliche Einträge gegen generiertes Manifest unabhängig vergleichen, CRC prüfen, jede Datei-Größe und SHA-256 der tatsächlichen Einträge kontrollieren, kritische JSON-/CSV-/Markdown-Dateien wieder einlesen. Manifest-Selbstreferenz mit sauberer Ausnahmeregel verhindern. Finale ZIP-SHA256 separat nach endgültigem Schließen berechnen. Wenn Integritätskontrollen scheitern, Status FAIL.

ZIP außerhalb des Git-Quellbaums/trackings erzeugen; nicht committen. Als **downloadbares GitHub-Actions-Artefakt** hochladen. CI-ZIP strikt sanitisiert: keinerlei private Koordinaten, Adresse, originale private Höhenprofile, Tokens, Passwörter, private Archivdateien; die private Audit-Kopie (falls vorhanden) bleibt lokal und wird nur mit expliziter Erlaubnis veröffentlicht. Ein schreibgeschütztes öffentliches Repo ist kein privater Datentresor. Alle Tests müssen vor Veröffentlichung prüfen, dass keine Geheimnisse enthalten sind.

Neue Entwicklungsrunden sollen **die gesamte aktuelle Dokumentation** erneut aufnehmen, damit spätere ZIPs selbstständig lesbar sind, ohne frühere ZIPs suchen zu müssen. Ältere Archive bleiben als gesonderte Historie erhalten, soweit Plattformretention dies erlaubt; korrigiere niemals alte Ergebnisse unbemerkt.

## 14. BERICHT NACH BEARBEITUNG

Antworte mit: Branch, aktuellem HEAD-Commit und PR-Link, durchgeführten Phasen und Codeänderungen, Testbefehlen und exakten PASS/FAIL-Zahlen, evidenzbasierter wissenschaftlicher Genauigkeitsbewertung und Grenzen, Ergebnissen realer Daten (oder NOT_EXECUTED), Performance, historischem Entwicklungspfad (FOUND_WITH_SOURCE / NOT_VERIFIED), aktuellem Webdeploymentstatus (NOT_DEPLOYED bis Freigabe), Link auf **fertiges herunterladenbares Dokumentations-ZIP**, dessen SHA256 und Integritätsstatus; nenne konkrete nächste Schritte.

**Beginne jetzt unmittelbar mit P0 und P1, implementiere danach die notwendigen Änderungen in diesem Branch. Antworte nicht nur mit einem neuen Plan.**
