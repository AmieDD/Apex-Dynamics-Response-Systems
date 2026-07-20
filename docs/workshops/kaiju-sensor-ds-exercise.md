<!-- markdownlint-disable-file -->
# Kaiju Sensor Grid — Data-Science Exercise (Instructor Guide)

An instructor-facing guide to the sensor-simulation data-science exercise. Attendees are given a raw, messy sensor log and must reconstruct structured, attributed monster tracks from it — practicing disciplined data-science process on realistic, no-domain-bias data.

> This guide contains the answer key. Do not hand it to attendees. The raw log ([data/sensor-grid.txt](../../data/sensor-grid.txt)) and the known-monster reference files ([data/monsters/](../../data/monsters/)) are the attendee-facing inputs.

## What the exercise is

The command center's radar emits a continuous stream of position pings from every monster, mixed together, with no identities attached. The attendee's job: turn that raw noise into a clean, per-monster, attributed dataset — the shape that could feed the dashboard.

Raw input → cluster into tracks → infer motion → attribute to a known monster → structured output.

## How to read one line

```text
2026-07-20T09:00:00.000Z lat=47.66012 lon=-122.46951 elev=34.6
└──── ISO timestamp ────┘ └latitude┘ └longitude ┘  └elevation┘
```

Four fields only: **when**, **where** (lat/lon in WGS84), and **elevation** (meters; positive = surfaced, negative = submerged). No identity, no speed, no size — everything else is inferred.

## The deliberate teaching traps

Coach attendees to discover these; they are the learning, not accidents.

1. **Interleaved / undifferentiated.** Consecutive lines belong to *different* monsters. Lines 1-3 jump across Puget Sound because they are three separate monsters, one ping each, merged into time order. → *Cluster pings back into per-monster tracks.*
2. **Missing fields.** ~6% of lines drop `elev=` (e.g. line 18). → *Handle missing data gracefully.*
3. **Legacy label quirk.** The column is `lon=`, not `lng=` (the app uses `lng` internally). → *Normalize field names; don't hard-code assumptions.*
4. **Meaning encoded in a sign.** Negative elevation means submerged. → *The data implies state you must derive.*
5. **Inferred velocity.** Speed and heading come only from position deltas between two consecutive pings of the *same* monster. → *Compute, don't read.*
6. **Ragged shape.** Monsters spawn staggered and have different track lengths, so tracks start and end at different times. → *Don't assume a clean rectangular dataset.*

Keep it minimal on purpose: a little noise, one dropped field type, one label quirk. The exercise is disciplined DS process, not a bug hunt.

## The attendee pipeline

1. **Parse** each line into `{ timestamp, lat, lng, elevation? }`, tolerating the missing `elev` and the `lon` label.
2. **Cluster** the interleaved pings into per-monster tracks using spatial + temporal continuity (each monster pings once per second along a straight line).
3. **Infer** velocity and heading from position deltas; **derive** submerged vs. surfaced from the elevation sign.
4. **Attribute** each track to a known monster by cross-referencing [data/monsters/](../../data/monsters/) (match `speedKmh`, `submerged`, `spawn`, `target`).
5. **Emit** a clean per-monster dataset (for example, one CSV row per monster) — the dashboard-ready output.

## Answer key (instructor only)

Six monsters. All spawn near the top of the minute and travel a straight line inland at 1 ping/second. Spawns are staggered by 375 ms so the streams interleave. Ground truth is defined in [src/mock/monsterDefs.ts](../../src/mock/monsterDefs.ts).

| Codename | First ping (UTC) | Spawn (lat, lon) | Target | Speed (km/h) | Submerged? | Pings |
|----------|------------------|------------------|--------|--------------|------------|-------|
| Gorathos | 09:00:00.000 | 47.660, -122.470 | SEATTLE | 34.5 | No (elev +) | 12 |
| Vespyra | 09:00:00.375 | 47.560, -122.540 | BELLEVUE | 62.0 | No (elev +) | 14 |
| Terrakon | 09:00:00.750 | 47.540, -122.420 | MERCER ISLAND | 22.5 | No (elev +) | 11 |
| Nyxmora | 09:00:01.125 | 47.730, -122.320 | KIRKLAND | 48.0 | Yes (elev -) | 13 |
| Skarnyx | 09:00:01.500 | 47.700, -122.560 | SEATTLE | 55.0 | Yes (elev -) | 15 |
| Molvorak | 09:00:01.875 | 47.500, -122.150 | BELLEVUE | 40.0 | No (elev +) | 13 |

Total: 78 pings. Attribution shortcuts to point out:

* **Submerged vs. surfaced** splits the six into two groups immediately (Nyxmora, Skarnyx submerged; the rest surfaced).
* **Spawn corner** is the cleanest discriminator — each monster's first ping sits at its unique spawn coordinate.
* **Speed** (from deltas) separates same-state monsters (e.g. slow Terrakon 22.5 vs. fast Vespyra 62.0).

Note: the "answer" is not truly secret — `MONSTER_DEFS` is committed and readable. The skill being taught is the reconstruction *process*, not guessing identities.

## Regenerating and tuning (instructor levers)

The log is deterministic: the same seed always produces the same file, so every attendee gets the identical puzzle.

```bash
npm run generate:sensor-log     # rewrite data/sensor-grid.txt + data/monsters/*.json
npm run lint:sensor-log         # verify the committed artifacts are in sync
```

| To change… | Edit | Knob |
|------------|------|------|
| Monsters, tracks, dataset size | [src/mock/monsterDefs.ts](../../src/mock/monsterDefs.ts) | `MONSTER_DEFS`, `trackSteps`, `SPAWN_STAGGER` |
| How messy the log is | [src/mock/sensorLogFormat.ts](../../src/mock/sensorLogFormat.ts) | `DROP_ELEV_PROB`, the `lon=` quirk |
| Noise, elevation bands, cadence | [src/mock/sensorLog.ts](../../src/mock/sensorLog.ts) | `NOISE_DEG`, elevation ranges, ping interval |

After any change, run `npm run generate:sensor-log` and commit the updated artifacts.

## Success criteria

* Attendee produces a cleaned, per-monster dataset within the allotted DS block.
* Attendee correctly attributes at least five of the six tracks to the known-monster list.
* Attendee's parser survives the missing field and the `lon` label without special-casing individual lines.
