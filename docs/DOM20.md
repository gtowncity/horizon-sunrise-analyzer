# DOM20

DOM20 samples visible surface at 0.2 m (5000² values per kilometre tile), including buildings, vegetation and temporary objects. It is derived by dense matching of oriented aerial imagery. Product documentation gives 0.4–0.6 m positional/height accuracy; the 20 cm pixel size is not the height accuracy. Dense canopy, occlusions, dates and artifacts require caution.

Critical mode samples the first 500 m and terrain samples within 0.15° of the terrain maximum. This avoids a blind download of every long-range DOM tile, but it is only a candidate-region estimate: a tall object in an excluded region can dominate the true surface horizon. The UI and export explicitly mark it incomplete. Full mode samples every point of each requested ray; it can consume substantial data and memory.

DOM−DGM is surface excess above terrain, not automatically tree height. Differing acquisition epochs and interpolation may yield negative differences. They are preserved rather than silently clipped.
