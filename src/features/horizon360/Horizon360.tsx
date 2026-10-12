import { useCallback, useEffect, useRef, useState } from "react";
import { validateHorizonInputs } from "./engine";
import {
  horizonDefaults,
  type HorizonInputs,
  type HorizonResult,
} from "./types";
import type { Progress } from "../../core/types";
import { HorizonChart, PolarDome } from "./Charts";
import { HorizonMap } from "./Map";
import {
  exportHorizonCSV,
  exportHorizonJSON,
  ninaEligibility,
  importHorizonJSON,
  selectedBlocker,
} from "./export";

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Horizon360() {
  const [inputs, setInputs] = useState(horizonDefaults),
    [result, setResult] = useState<HorizonResult>(),
    [progress, setProgress] = useState<Progress>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const select = useCallback((a: number) => setSelected(a), []);
  const set = <K extends keyof HorizonInputs>(
    key: K,
    value: HorizonInputs[K],
  ) => {
    setInputs((i) => ({ ...i, [key]: value }));
    setResult(undefined);
  };
  const field = (key: keyof HorizonInputs, label: string, step = 0.1) => (
    <label key={key}>
      {label}
      <input
        type="number"
        step={step}
        value={
          typeof inputs[key] === "number" && Number.isFinite(inputs[key])
            ? (inputs[key] as number)
            : ""
        }
        onChange={(e) =>
          set(key, e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
  const start = () => {
    try {
      validateHorizonInputs(inputs);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    worker.current?.terminate();
    const w = new Worker(new URL("./horizon.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    setBusy(true);
    setError("");
    setResult(undefined);
    setProgress({
      stage: "Start",
      fraction: 0,
      detail: "Reale Daten werden angefordert",
    });
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.progress);
      else {
        setBusy(false);
        w.terminate();
        if (e.data.type === "result") setResult(e.data.result);
        else setError(e.data.message);
      }
    };
    w.onerror = () => {
      setError("360°-Worker fehlgeschlagen");
      setBusy(false);
      w.terminate();
    };
    w.postMessage(inputs);
  };
  const nearest = result?.directions.reduce((best, d) =>
    Math.min(
      Math.abs(d.azimuth - selected),
      360 - Math.abs(d.azimuth - selected),
    ) <
    Math.min(
      Math.abs(best.azimuth - selected),
      360 - Math.abs(best.azimuth - selected),
    )
      ? d
      : best,
  );
  const blocker = nearest ? selectedBlocker(nearest) : null;
  return (
    <main id="results" className="h360-main">
      <div className="main-heading">
        <div>
          <span className="eyebrow">BAYERN · DGM1 / DOM20</span>
          <h1>360°-Horizont</h1>
        </div>
        <strong>Forschungsstand · VORLÄUFIG</strong>
      </div>
      <p>
        Nord 0° · Ost 90° · Süd 180° · West 270°. Schnell und Detail liefern
        adaptive Stichproben; vollständige räumliche Abdeckung ist nicht
        nachgewiesen.
      </p>
      <section className="panel">
        <fieldset disabled={busy} className="h360-inputs">
          <legend>Beobachter und Untersuchungsgebiet</legend>
          <label>
            Breite ° N
            <input
              type="number"
              step="0.00001"
              value={
                Number.isNaN(inputs.observer.lat) ? "" : inputs.observer.lat
              }
              onChange={(e) =>
                set("observer", {
                  ...inputs.observer,
                  lat: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Länge ° E
            <input
              type="number"
              step="0.00001"
              value={
                Number.isNaN(inputs.observer.lon) ? "" : inputs.observer.lon
              }
              onChange={(e) =>
                set("observer", {
                  ...inputs.observer,
                  lon: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
          </label>
          {field("relativeHeight", "Optik über DGM1-Boden · m")}
          <label>
            Rechenmodus
            <select
              aria-label="Rechenmodus"
              value={inputs.mode}
              onChange={(e) => {
                const detail = e.target.value === "DETAIL";
                setInputs((i) => ({
                  ...i,
                  mode: detail ? "DETAIL" : "FAST",
                  initialAzimuthStep: detail ? 5 : 10,
                  minimumAzimuthStep: detail ? 0.5 : 1,
                  radialStep: detail ? 1 : 10,
                  maxRays: detail ? 360 : 144,
                  maxSamples: detail ? 500000 : 100000,
                }));
                setResult(undefined);
              }}
            >
              <option value="FAST">Schnell / Übersicht</option>
              <option value="DETAIL">Detail / native Zellprüfung</option>
            </select>
          </label>
          {field("terrainDistance", "Gelände-Reichweite · m", 10)}
          {field("surfaceDistance", "DOM-Nahbereich · m", 10)}
          {field("minAltitude", "Mindesthöhe · °")}
          {field("margin", "Angegebene Sicherheitsreserve · °")}
          <details>
            <summary>Modelle, Unsicherheit und Ressourcen</summary>
            <div className="h360-inputs">
              <label>
                Absolute Optikhöhe DHHN2016 · m (optional)
                <input
                  type="number"
                  step="0.01"
                  value={inputs.absoluteEyeHeight ?? ""}
                  onChange={(e) =>
                    set(
                      "absoluteEyeHeight",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
              </label>
              {field("terrainK", "Terrestrisches k Gelände", 0.01)}
              {field("surfaceK", "Terrestrisches k Oberfläche", 0.01)}
              {field(
                "positionUncertainty",
                "Angegebene Positionsunsicherheit · m",
              )}
              {field(
                "verticalUncertainty",
                "Angegebenes vertikales Budget · m",
              )}
              {field(
                "opticalHorizontalMotion",
                "Optikbewegung horizontaler Radius · m",
              )}
              {field("opticalHeightBelow", "Optikbewegung nach unten · m")}
              {field("opticalHeightAbove", "Optikbewegung nach oben · m")}
              {field(
                "terrainHeightError",
                "Angenommene DGM-Höhenfehlergrenze · m",
              )}
              {field(
                "surfaceHeightError",
                "Angenommene DOM-Höhenfehlergrenze · m",
              )}
              {field("maxCells", "Maximale native Rasterzellen", 1000)}
              {field("radialStep", "Radialschritt · m")}
              {field("initialAzimuthStep", "Start-Azimutschritt · °")}
              {field("minimumAzimuthStep", "Minimaler Azimutschritt · °")}
              {field("refinementTolerance", "Verfeinerungsauslöser · °", 0.01)}
              {field("maxRays", "Maximale Strahlen", 1)}
              {field("maxSamples", "Maximale Abfragen", 1000)}
              {field("maxTiles", "Maximale neue Kacheln", 1)}
              {field("maxArchiveBytes", "Archivbudget · Bytes", 1048576)}
            </div>
            <p>
              Absolute Optikhöhe ersetzt Boden + relative Höhe. Budgets und
              Unsicherheiten sind keine garantierte physische Fehlergrenze.
              Archivbedarf vor Abruf unbekannt.
            </p>
          </details>
        </fieldset>
        {busy ? (
          <button
            onClick={() => {
              worker.current?.terminate();
              setBusy(false);
              setError(
                "Analyse abgebrochen. Geladene Quellen bleiben im Cache.",
              );
            }}
          >
            360° abbrechen
          </button>
        ) : (
          <button onClick={start}>360° berechnen</button>
        )}
        <button
          disabled={busy}
          onClick={() =>
            navigator.clipboard
              .writeText(`${inputs.observer.lat}, ${inputs.observer.lon}`)
              .catch(() => setError("Zwischenablage nicht verfügbar"))
          }
        >
          Koordinate kopieren
        </button>
        <label>
          Wissenschaftliches JSON importieren
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const r = importHorizonJSON(await file.text());
                setInputs(r.inputs);
                setResult(r);
                setError("");
              } catch (x) {
                setError((x as Error).message);
              }
              e.target.value = "";
            }}
          />
        </label>
      </section>
      {busy && progress && (
        <div role="status" className="progress-box">
          <strong>{progress.stage}</strong>
          <span>{progress.detail}</span>
          <progress max="1" value={progress.fraction} />
          {progress.performance && (
            <span>
              {progress.performance.uniqueTiles} Quelldateien ·{" "}
              {(progress.performance.archiveBytes / 1048576).toFixed(2)} MiB ZIP
            </span>
          )}
        </div>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {result && (
        <section className="panel">
          <h2>Höhe über Azimut · 360°</h2>
          <p>
            Schraffur = INCOMPLETE. Kurven zeigen ausschließlich abgetastete
            Maxima; nicht erfasste Dachkanten und schmale Hindernisse sind
            möglich.
          </p>
          <HorizonChart result={result} selected={selected} onSelect={select} />
        </section>
      )}
      <label>
        Ausgewählter Azimut · °
        <input
          aria-label="Azimut-Schieberegler · °"
          type="range"
          min="0"
          max="359.9"
          step="0.1"
          value={selected}
          onChange={(e) => select(Number(e.target.value))}
        />
        <input
          aria-label="Ausgewählter Azimut · °"
          type="number"
          min="0"
          max="359.9"
          step="0.1"
          value={selected}
          onChange={(e) => {
            const a = Number(e.target.value);
            if (Number.isFinite(a) && a >= 0 && a < 360) select(a);
          }}
        />
      </label>
      <div className="h360-secondary">
        <section className="panel">
          <h2>Polare Himmelskuppel</h2>
          {result ? (
            <PolarDome result={result} selected={selected} onSelect={select} />
          ) : (
            <p>Noch keine Höhendaten.</p>
          )}
          <p>
            Zenit innen, 0° außen. Negative Winkel werden nur hier am Rand
            gekappt. Schraffur = ungeprüfte Restflächen.
          </p>
        </section>
        <section className="panel">
          <h2>Untersuchungsgebiet und Blocker</h2>
          {Number.isFinite(inputs.observer.lat) &&
            Number.isFinite(inputs.observer.lon) &&
            Number.isFinite(inputs.terrainDistance) && (
              <HorizonMap
                observer={inputs.observer}
                distance={inputs.terrainDistance}
                surfaceDistance={inputs.surfaceDistance}
                result={result}
                selected={selected}
                onPoint={(p) => {
                  if (!busy) set("observer", p);
                }}
              />
            )}
        </section>
      </div>
      {nearest && (
        <section className="panel" aria-live="polite">
          <h2>Ausgewählte Richtung</h2>
          <p>
            {nearest.azimuth.toFixed(3)}° ·{" "}
            {nearest.actual?.toFixed(4) ?? "UNKNOWN"}° · {nearest.status} ·
            nächste Winkellücke {nearest.nextAngularGap.toFixed(3)}°
          </p>
          {blocker && (
            <p>
              {blocker.model.toUpperCase()} Rasteroberfläche bei{" "}
              {blocker.distance.toFixed(2)} m · {blocker.lat.toFixed(7)},{" "}
              {blocker.lon.toFixed(7)} · Kachel {blocker.tile}. Objektklasse
              unbekannt.
            </p>
          )}
          <p>
            DGM: {nearest.terrain.valid}/{nearest.terrain.attempted} gültige
            Abfragen; DOM: {nearest.surface.valid}/{nearest.surface.attempted}.
            Kein gemessenes Konfidenzintervall.
          </p>
        </section>
      )}
      {result && (
        <>
          <section className="panel">
            <h2>Wissenschaftlicher Status und Quellen</h2>
            <p>
              Boden {result.ground.toFixed(3)} m DHHN2016 · Optik{" "}
              {result.eye.toFixed(3)} m · {result.directions.length} Richtungen
              · {result.evaluatedSamples} Abfragen ·{" "}
              {(result.elapsedMs / 1000).toFixed(2)} s gemessene Wandzeit ·
              konservative Kachel-Vorauswahl {result.preflight.tileUpperBound};
              Bytebedarf unbekannt.
            </p>
            <ul>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <details>
              <summary>Quellnachweise und Messwerte</summary>
              <pre>
                {JSON.stringify(
                  {
                    commit: result.commit,
                    method: result.method,
                    tiles: result.tiles,
                    performance: result.performance,
                    cellMetrics: result.cellMetrics,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </section>
          {result.spatialAudit && (
            <section className="panel">
              <h2>Rasterzellprüfung und Unsicherheitsintervalle</h2>
              <p>
                EPSG25832-Gitternord; getrennt von der geografischen Höhenkurve.
                KONDITIONALE MODELLGRENZEN, keine vor Ort validierten Messungen.
                Positions-/Optikradius {result.spatialAudit.observerRadius} m;
                Augenhöhenintervall{" "}
                {result.spatialAudit.eyeRange?.join(" … ") ?? "UNKNOWN"} m.
              </p>
              <ul>
                {result.spatialAudit.errors.map((e, n) => (
                  <li key={n}>{e}</li>
                ))}
              </ul>
              {[
                ["DGM1", result.spatialAudit.terrain],
                ["DOM20", result.spatialAudit.surface],
              ].map(([name, raw]) => {
                const scan = raw as NonNullable<
                  HorizonResult["spatialAudit"]
                >["terrain"];
                if (!scan) return null;
                return (
                  <details key={name as string}>
                    <summary>
                      {name as string}: {scan.evaluatedCells} native Zellen ·
                      Traversierung{" "}
                      {scan.completeTraversal
                        ? "vollständig im Rastermodell"
                        : "UNVOLLSTÄNDIG"}
                    </summary>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Gitternord-Sektor °</th>
                            <th>Bekannte Teilzellen-Obergrenze °</th>
                            <th>Vollständige Modellobergrenze °</th>
                            <th>Status</th>
                            <th>Fehlende Zellen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scan.sectors.map((s) => (
                            <tr key={s.start}>
                              <td>
                                {s.start} … {s.end}
                              </td>
                              <td>
                                {s.knownCellUpper?.toFixed(6) ?? "UNKNOWN"}
                              </td>
                              <td>{s.modelUpper?.toFixed(6) ?? "UNKNOWN"}</td>
                              <td>{s.status}</td>
                              <td>{s.missing}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </section>
          )}
          <section className="panel">
            <h2>Reproduzierbare Exporte</h2>
            <button
              onClick={() =>
                save(
                  exportHorizonJSON(result),
                  "astro360-scientific.json",
                  "application/json",
                )
              }
            >
              360° JSON exportieren
            </button>
            <button
              onClick={() =>
                save(
                  exportHorizonCSV(result),
                  "astro360-scientific.csv",
                  "text/csv",
                )
              }
            >
              360° CSV exportieren
            </button>
            <button disabled>N.I.N.A. physisch · GESPERRT</button>
            <button disabled>N.I.N.A. Planung · GESPERRT</button>
            <p>
              Fehlende räumliche Nachweise können nicht durch eine Bestätigung
              ersetzt werden. N.I.N.A. würde numerische Lücken interpolieren.
            </p>
            <ul>
              {ninaEligibility(result).reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <details>
              <summary>Richtungstabelle (vollständig)</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Azimut °</th>
                      <th>DGM °</th>
                      <th>DOM °</th>
                      <th>Maximum °</th>
                      <th>Planung °</th>
                      <th>Status</th>
                      <th>Winkellücke °</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.directions.map((d) => (
                      <tr key={d.azimuth}>
                        <td>{d.azimuth.toFixed(4)}</td>
                        <td>
                          {d.terrain.blocker?.angle.toFixed(6) ?? "UNKNOWN"}
                        </td>
                        <td>
                          {d.surface.blocker?.angle.toFixed(6) ?? "UNKNOWN"}
                        </td>
                        <td>{d.actual?.toFixed(6) ?? "UNKNOWN"}</td>
                        <td>{d.planning?.toFixed(6) ?? "UNKNOWN"}</td>
                        <td>{d.status}</td>
                        <td>{d.nextAngularGap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </>
      )}
      <footer>
        Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de ·
        CC BY 4.0. Karte: OpenStreetMap. Standort bleibt in der lokalen
        Anwendung; Daten-/Kartenabrufe offenbaren das angefragte Gebiet den
        Diensten.
      </footer>
    </main>
  );
}
