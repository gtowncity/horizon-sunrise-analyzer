// N.I.N.A. Standard parser methods from commit 5f137612aba9a4360f365232763525bfd8d4a866.
// Copyright 2016-2026 Stefan Berg and the N.I.N.A. contributors.
// MPL-2.0: https://mozilla.org/MPL/2.0/ . Parser/grooming methods unchanged;
// surrounding constructor/logger are a minimal execution scaffold, not the NINA application.
using System; using System.IO; using System.Linq; using System.Collections.Generic; using System.Globalization; public static class Logger { public static void Warning(string s) {} } public class CustomHorizon { public double[] Azimuths; public double[] Altitudes; private CustomHorizon(IDictionary<double,double> m) { Azimuths=m.Keys.ToArray(); Altitudes=m.Values.ToArray(); }private static void GroomHorizonData(SortedDictionary<double, double> horizonMap) {
            if (horizonMap.Count < 2) {
                throw new ArgumentException("Horizon file does not contain enough entries or is invalid");
            }

            // Groom Incomplete Data
            // 1) No 0 or 360 Azimuth is detected => Find the nearest datapoint and add it to the list
            // 2) No 0 Azimuth is present but 360 Azimuth is present => Add value from 360 to 0
            // 2) No 360 Azimuth is present but 0 Azimuth is present => Add value from 0 to 360
            if (!horizonMap.ContainsKey(0) && !horizonMap.ContainsKey(360)) {
                var nearest0Azimuth = horizonMap.Keys.OrderBy(x => Math.Abs(x)).First();
                var nearest360Azimuth = horizonMap.Keys.OrderByDescending(x => Math.Abs(x)).First();

                var key = nearest0Azimuth;
                if (360 - nearest360Azimuth < nearest0Azimuth) {
                    key = nearest360Azimuth;
                }

                horizonMap[0] = horizonMap[key];
                horizonMap[360] = horizonMap[key];
            } else if (!horizonMap.ContainsKey(0) && horizonMap.ContainsKey(360)) {
                horizonMap[0] = horizonMap[360];
            } else if (horizonMap.ContainsKey(0) && !horizonMap.ContainsKey(360)) {
                horizonMap[360] = horizonMap[0];
            }
        }
public static CustomHorizon FromReader_Standard(TextReader sr) {
            var horizonMap = new SortedDictionary<double, double>();

            string line;
            while ((line = sr.ReadLine()?.Trim()) != null) {
                // Lines starting with # are comments
                if (!line.StartsWith("#") && !string.IsNullOrEmpty(line)) {
                    var columns = line.Split(new char[] { '\t', ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
                    if (columns.Length == 2) {
                        if (double.TryParse(columns[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var azimuth)) {
                            if (double.TryParse(columns[1], NumberStyles.Any, CultureInfo.InvariantCulture, out var altitude)) {
                                horizonMap[azimuth] = altitude;
                            } else {
                                Logger.Warning($"Invalid value for altitude {columns[0]}");
                            }
                        } else {
                            Logger.Warning($"Invalid value for azimuth {columns[0]}");
                        }
                    } else {
                        Logger.Warning($"Invalid line for horizon values {line}");
                    }
                }
            }

            GroomHorizonData(horizonMap);
            return new CustomHorizon(horizonMap);
        }
}
