# Input schema v1

observer: WGS84 lat/lon; rectangular search envelope 47..51 N / 8.5..14.1 E includes Bayern but is not an administrative containment proof. Missing official data outside coverage stays unknown. No private default; existing Munich public default only.

mode FAST | DETAIL; terrainDistance 10..80000 m; surfaceDistance 0..min(terrainDistance,2000) m. relativeHeight 0.05..100 m. absoluteEyeHeight optional -100..4000 m, exclusively DHHN2016. minAltitude -90..90°, margin 0..30°. terrainK and surfaceK 0..0.5 independently. positionUncertainty and verticalUncertainty in m are declared sensitivities, not propagated safety bounds. optical motion range requires follow-up implementation and is not implicitly zero physical uncertainty.

initialAzimuthStep 1..30°; minimumAzimuthStep 0.1..initial; radialStep 0.2..100 m; refinementTolerance 0.001..5°; maxRays 12..720; maxSamples 1000..2000000; maxTiles 1..100; maxArchiveBytes 1..1024 MiB. Default mode budgets differ. Bounds are runtime validated, including integers and finite values.

No coordinates in URL, telemetry or CI logs. Coordinates in scientific exports are intentional local user downloads. No automatic persistence of result locations.
