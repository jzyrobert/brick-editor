# Design language of official sets

What makes an official LEGO model look like a LEGO design, measured on 30 models from the LDraw Official Model Repository and compared with our build-script samples. The practical rules drawn from it are in [AGENT-BUILDING.md](AGENT-BUILDING.md#design-rules-from-official-sets) and the [build agent prompt](../prompts/build-agent.md).

## Models studied

The models are fan-made LDraw versions of the official sets, reviewed by LDraw.org and published in the [OMR](https://library.ldraw.org/omr) under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) (the files say "Redistributable under CCAL version 2.0"). Each is credited to the author named in its file. The files were downloaded once, 4 s apart, for this study and are not part of the repository. "Parts" counts the parts analysed; minifigures, animals and stickers are left out.

| Set     | Name                     | Theme                       | Year | Parts | Model by                                |
| ------- | ------------------------ | --------------------------- | ---- | ----- | --------------------------------------- |
| 3178-1  | Seaplane                 | City > Harbor               | 2010 | 96    | Marc Giraudet [Mad_Marc]                |
| 376-2   | Town House with Garden   | Town > Classic Town         | 1978 | 211   | Robert Paciorek [bercik]                |
| 6067-1  | Guarded Inn              | Castle > Lion Knights       | 1986 | 214   | Stefan Frenz [smf]                      |
| 31009-1 | Small Cottage            | Creator 3-in-1              | 2013 | 259   | Stefan Frenz [smf]                      |
| 6279-1  | Skull Island             | Pirates I                   | 1995 | 305   | Stan Isachenko [angmarec]               |
| 374-1   | Fire Station             | Town > Classic Town         | 1978 | 314   | Takeshi Takahashi [RainbowDolphin]      |
| 928-1   | Galaxy Explorer          | Space > Classic Space       | 1979 | 319   | Willy Tschager [Holly-Wood]             |
| 31048-1 | Lakeside Lodge           | Creator 3-in-1              | 2016 | 352   | Stefan Frenz [smf]                      |
| 7997-1  | Train Station            | City > Trains               | 2007 | 353   | Marc Giraudet [Mad_Marc]                |
| 6074-1  | Black Falcon's Fortress  | Castle > Black Falcons      | 1986 | 379   | Stefan Frenz [smf]                      |
| 6980-1  | Galaxy Commander         | Space > Classic Space       | 1983 | 407   | Willy Tschager [Holly-Wood]             |
| 2150-1  | Train Station            | Train > 9V                  | 1996 | 522   | Robert Paciorek [bercik]                |
| 5891-1  | Apple Tree House         | Creator 3-in-1              | 2010 | 537   | Marc Giraudet [Mad_Marc]                |
| 6080-1  | King's Castle            | Castle > Lion Knights       | 1984 | 566   | Stefan Frenz [smf]                      |
| 10176-1 | Royal King's Castle      | Castle > Knights Kingdom II | 2006 | 740   | Marc Giraudet [Mad_Marc]                |
| 6285-1  | Black Seas Barracuda     | Pirates I                   | 1989 | 864   | Philippe Hurbain [Philo]                |
| 10194-1 | Emerald Night            | Creator Expert              | 2009 | 1,031 | TotalyWicked [TotalyWicked]             |
| 4954-1  | Model Town House         | Creator 3-in-1              | 2007 | 1,174 | Marc Giraudet [Mad_Marc]                |
| 10315-1 | Tranquil Garden          | Icons                       | 2023 | 1,296 | Orion Pobursky [OrionP]                 |
| 10220-1 | Volkswagen T1 Camper Van | Creator Expert              | 2011 | 1,403 | Stan Isachenko [angmarec]               |
| 10258-1 | London Bus               | Creator Expert              | 2017 | 1,681 | Philippe Hurbain [Philo]                |
| 10182-1 | Cafe Corner              | Modular Buildings           | 2007 | 2,015 | Max Martin Richter [MMR1988]            |
| 21325-1 | Medieval Blacksmith      | LEGO Ideas                  | 2021 | 2,073 | Vincent Messenet [Cheenzo]              |
| 10197-1 | Fire Brigade             | Modular Buildings           | 2009 | 2,216 | Max Martin Richter [MMR1988]            |
| 10185-1 | Green Grocer             | Modular Buildings           | 2008 | 2,250 | Max Martin Richter [MMR1988]            |
| 10243-1 | Parisian Restaurant      | Modular Buildings           | 2014 | 2,316 | Willy Tschager [Holly Wood]             |
| 10270-1 | Bookshop                 | Modular Buildings           | 2020 | 2,410 | Ulrich Röder [UR]                       |
| 10264-1 | Corner Garage            | Modular Buildings           | 2019 | 2,459 | Jaco van der Molen [Jaco van der Molen] |
| 10224-1 | Town Hall                | Modular Buildings           | 2012 | 2,704 | Marc Giraudet [Mad_Marc]                |
| 21318-1 | Tree House               | LEGO Ideas                  | 2019 | 2,804 | Orion Pobursky [OrionP]                 |

## Method

Each main model was flattened through its submodels. Part names and categories come from the complete LDraw library; each part's occupancy boxes (the same data the build checks use) were rasterised onto a grid of one stud by one plate. From that grid and the parts list the scripts measured:

- the parts mix: plates per brick, tiles per plate, the share of 1 × 1 and 1 × 2 parts, the lengths of 1-wide bricks, detail parts per 100 parts (1-wide tiles, SNOT, inverted slopes, headlight bricks, jumpers, cheese slopes);
- colours: how many colours make up 80 % of the parts, and the leading colours;
- structure: how much of each vertical column between its lowest and highest part is empty (hollowness), and how often the vertical joint between two bricks of a course is covered by one part in the course above (bond);
- tops: the share of the top-down view that shows studs;
- facades: looking at each side, the frontmost part in every stud × plate cell, and along each row how often the colour or the depth changes from one stud to the next, the mean length of a run with the same colour, depth and kind of part, the share of plates and tiles, and the number of different parts seen per stud × brick of facade;
- instructions: parts per STEP.

Thirteen of the models were also rendered in the app from the same framing the build CLI uses, to check the numbers against what the eye sees. Our samples were compiled from `fixtures/build-scripts/` and measured with the same scripts.

## What the numbers say

Medians, with the range in brackets. "Modular" is the seven Modular Buildings; "houses" the Creator houses, classic town houses, stations and the Medieval Blacksmith; "ours" the Market town, Harbour, Cathedral and Santorini samples.

| Measure                                         | Modular          | Houses           | Castle/pirate    | Vehicles/space   | Ours             |
| ----------------------------------------------- | ---------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| Plates per brick                                | 0.91 (0.81–1.51) | 0.92 (0.14–1.27) | 0.56 (0.35–1.91) | 2.4 (1.5–15.5)   | 0.32 (0.10–0.82) |
| Share of parts that are 1 × 1 or 1 × 2          | 0.49 (0.44–0.59) | 0.39 (0.32–0.52) | 0.49 (0.32–0.54) | 0.40 (0.17–0.45) | 0.26 (0.26–0.46) |
| Mean length of 1-wide bricks (studs)            | 3.0 (2.5–3.2)    | 2.9 (2.0–3.7)    | 2.0 (1.9–2.9)    | 2.3 (2.0–3.1)    | 5.1 (3.5–5.4)    |
| Share of 1-wide bricks 6 or more long           | 0.18 (0.12–0.25) | 0.14 (0.03–0.31) | 0.06 (0.02–0.16) | 0.06 (0–0.13)    | 0.41 (0.17–0.47) |
| 1-wide tiles per 100 parts                      | 13 (7–17)        | 4 (0–13)         | 2 (0–4)          | 6 (3–9)          | 3 (1.5–3.9)      |
| SNOT parts per 100 parts                        | 4.1 (1.3–5.4)    | 0.8 (0–10.7)     | 1.0 (0.5–2.2)    | 2.2 (0–8.6)      | 0                |
| Inverted slopes per 100 parts                   | 1.4 (0.6–2.1)    | 2.3 (0–6.0)      | 5.4 (2.6–9.3)    | 2.6 (0.8–9.4)    | 0                |
| Headlight bricks, jumpers, cheese per 100 parts | 4.3 (2.0–7.4)    | 3.1 (0–16.6)     | 1.6 (0.7–2.3)    | 1.0 (0–14)       | 0                |
| Slopes, % of parts                              | 6 (4–8)          | 13 (4–26)        | 13 (9–19)        | 10 (6–21)        | 13 (0–17)        |
| Colours making up 80 % of parts                 | 6 (5–8)          | 5 (3–9)          | 2 (1–4)          | 4 (2–5)          | 7 (3–11)         |
| Top view showing studs                          | 0.38 (0.35–0.47) | 0.40 (0.09–0.86) | 0.69 (0.57–0.89) | 0.32 (0.18–0.62) | 0.19 (0.05–0.45) |
| Column hollowness                               | 0.66 (0.62–0.72) | 0.60 (0.39–0.69) | 0.62 (0.51–0.70) | 0.40 (0.27–0.62) | 0.69 (0.59–0.83) |
| Brick end joints covered in the course above    | 0.91 (0.76–0.95) | 0.90 (0.48–1.00) | 0.62 (0–1.00)    | 0.84 (0.71–0.94) | 0.88 (0.48–0.93) |
| Facade: colour changes per stud                 | 0.33 (0.22–0.44) | 0.26 (0.13–0.41) | 0.28 (0.10–0.34) | 0.27 (0.15–0.49) | 0.20 (0.16–0.23) |
| Facade: depth changes per stud                  | 0.41 (0.28–0.50) | 0.29 (0.21–0.44) | 0.44 (0.40–0.56) | 0.36 (0.23–0.76) | 0.26 (0.15–0.33) |
| Facade: mean run of identical surface (studs)   | 2.0 (1.6–2.3)    | 2.1 (1.8–2.4)    | 1.7 (1.4–1.7)    | 1.7 (1.2–2.0)    | 2.8 (2.5–3.5)    |
| Facade: share of plates and tiles               | 0.31 (0.28–0.44) | 0.20 (0.03–0.55) | 0.13 (0.08–0.37) | 0.41 (0.23–0.51) | 0.12 (0.01–0.30) |
| Facade: different parts per stud × brick        | 0.85 (0.83–1.00) | 0.77 (0.55–1.09) | 0.60 (0.54–0.69) | 0.81 (0.55–1.40) | 0.64 (0.51–0.69) |
| Parts per instruction step (median)             | 3 (2–14)         | 4 (2–10)         | 6.5 (3–11)       | 4 (2–11)         | no steps         |

The two landscape-heavy sets (Tree House, Tranquil Garden) are in the per-model data but not in a column: plates per brick 3.3–3.8, 9–12 colours for 80 % of parts, 7–12 plants per 100 parts.

## Findings

**Walls are short bricks, and not all bricks.** Official facades are built from 1 × 1 to 1 × 4 bricks (mean 1-wide brick length 3 studs in the modulars, 2 in the castles); fewer than one in five 1-wide bricks is 6 or more long. Our compiler packs the longest brick that fits, so our walls average 5 studs and 41 % of them are 1 × 6 to 1 × 16. Official walls are also broken up every few studs by windows, pilasters and quoins, which forces short bricks. On top of that, a third of every modular facade is plates and tiles (bands, sills, lintels, cornices), against an eighth of ours.

**Bonding is not the problem.** Where two bricks of a course meet end to end, 91 % of the joints in the modulars are covered by one part in the course above; ours reach 86–93 % (the Cathedral's 48 % comes from its many 1 × 1 lancet bricks). The first, cruder count, which also counted the long seam between two rows of a 2-thick wall, scored our samples 0.28–0.49. That comes from thick massing (`box` with `interior: "fill"`, 2-thick walls), which official models almost never use.

**Hollow, with floors as ties.** Official buildings are as hollow as ours (about two-thirds of every column is empty). The difference is what holds them: every storey has a full plate floor, 22–32 plates apart (Cafe Corner 29 and 28 plates, Green Grocer 32, 27 and 22, Town Hall 46, 24 and 22: the ground floor is the tallest and each storey above is lower), and the storeys simply rest on each other's studs (so they lift off); Technic bricks with holes and pins join a modular to its neighbours. Our shop component's storeys are 19–21 plates.

**Detail density.** A modular facade shows 0.85 different parts per stud × brick; ours 0.64. The gap is in small parts: official models use 13 1-wide tiles, 4 SNOT parts, 4 headlight bricks, jumpers and cheese slopes, and 1–2 inverted slopes per 100 parts; our samples use almost none (the compiler only emits them through `place`). 1 × 1 and 1 × 2 parts are half of every official model and a quarter of ours.

**Facades change every 2 studs.** Along a row of an official facade the colour changes on a third of the steps and the depth (how far the surface stands out) on 40 %; the mean run of identical surface is 2 studs. Ours change colour on 20 % and depth on 26 % of steps, with runs of 2.8 studs. What breaks official facades up, seen in the renders:

- **Three-part facades**: a plinth or a stone ground floor in grey (light or dark bluish grey, often masonry bricks), a main body in the wall colour, a cornice at the top (tan, white or grey plates, tiles, inverted slopes and brackets).
- **Bands at every floor line**: a plate or plate-and-tile string course, often protruding one stud (Town Hall, Green Grocer, Cafe Corner). Sills and lintels in white or tan under and over each window.
- **Quoins and pilasters**: the corners of Green Grocer, Model Town House and Parisian Restaurant are light or dark bluish grey blocks, 2 studs along one face and 1 along the other, alternating course by course. Cafe Corner and Town Hall have piers of 1 × 1 round bricks or log bricks between the windows.
- **Openings every 3–4 studs** on the street side, framed in a contrasting colour (white frames in sand green, dark red or tan walls).
- **Depth layers**: 5–14 distinct depths per facade (bays, balconies, awnings, window boxes, recessed doors with steps).

**Roofs.** Creator and classic houses: 45° slopes (2 × 4, 2 × 2, 2 × 1) with 33° 3 × 4 slopes at the eaves; hip roofs with a ridge; dormers and bay windows get their own small hip or gable roofs (Apple Tree House, Model Town House, Small Cottage). Modulars: flat roofs with a parapet and a studded grey roof surface (only about 38 % of their top view is studs, but the flat roofs are left studded), or mansard roofs of dark slopes and curved slopes (Cafe Corner, Green Grocer, Parisian Restaurant). Slopes are only 4–8 % of a modular's parts. The Medieval Blacksmith's roof is tiles laid as shingles over a plate base.

**Palettes.** The modulars use 5–8 colours for 80 % of their parts, most of them neutral: light bluish grey (18–40 %), dark bluish grey, black, white and tan, plus one wall colour (dark red, sand green, dark orange, medium nougat, olive green, dark turquoise, reddish brown) at 8–20 %. Castles are 1–2 colours (grey with black accents at random; 60/35 light grey to black in King's Castle). Vehicles are a body colour plus black and greys. Landscape-heavy sets spread over 9–12 colours in small amounts (flowers).

**Castle walls.** Crenellations from alternating 1 × 1 and 1 × 2 bricks, arrow slits as 1-stud gaps, black and dark grey bricks scattered through grey walls, big wall panels (2 × 5 × 6) on hinges, green baseplates for courtyards. The castles have the lowest facade detail (0.6 parts per stud × brick) but the most depth changes (0.44 per stud).

**Vehicles and landscapes are plates.** 2 to 15 plates per brick in the vehicles, 3.3–3.8 in the landscape-heavy sets: terrain is stacked, stepped plates with tiles and plants, not bricks.

**Instructions.** Official steps add 2–14 parts (median 3–4), and the OMR files split a model into many small submodels (a median of 3–18 parts each in the modulars). Our compiled builds have no steps; a section is one submodel of hundreds or thousands of parts.

## Why ours look less like real LEGO designs

1. **Long plain bricks.** 41 % of our 1-wide bricks are 6 or more long; walls read as flat panels. Official walls are interrupted every 3–4 studs.
2. **One colour per wall.** A building is a wall colour, a roof colour and white frames. There is no plinth, band, quoin, sill or cornice unless the script adds one by hand, and the samples mostly do not.
3. **No small parts on facades.** No 1-wide tiles, SNOT, headlight bricks or inverted slopes: the texture and the shadow lines of official facades are missing.
4. **Too smooth on top.** `top: "tile"`, `smooth` and slopes leave 5–45 % of our top view studded against 38 % for the modulars. Official flat roofs keep their studs; tiles go on walkways, sills, parapet tops and floors.
5. **Too many colours across a scene, too few per building.** A town of eleven houses in eleven palettes needs 7–11 colours for 80 % of the parts; each official building needs 5–8, with most of it neutral grey.
6. **Low storeys.** 19–21 plates, where official storeys are 22–32 (8–10 bricks plus a plate floor).
7. **Thick massing.** Solid and 2-thick boxes give parallel seams that bricks above cannot bond across, and many parts nobody sees.

## What changed

The build language gained four options from this study (see [AGENT-BUILDING.md](AGENT-BUILDING.md#ops)):

- `texture: "masonry" | "log" | "grille"` on `box`, `cylinder`, `wall` and `room`: textured 1 × 2 bricks (98283, 30136, 2877) instead of plain bricks, 1 × 1 bricks at the ends; plain bricks, and a `texture-unavailable` warning, where the colour lacks them.
- `pattern: "courses"` with a `{"mix": [...]}` colour: the colours go course by course (stripes, bands) instead of per piece.
- `quoins: colour` on `room` and `box`: interlocking corner blocks, 2 studs along one face and 1 along the other, alternating course by course.
- `supports: n` on hollow `box`es: a 2 × 2 pier every n studs under the lid.

The [Town house](../fixtures/build-scripts/townhouse.json) example (561 parts from a 2 KB script) uses all of them except `supports` and `pattern`: a masonry ground floor, sand green upper storeys with grey quoins, white string courses at every floor line and white sill and lintel courses, a tan parapet on a studded flat roof. Its mean 1-wide brick is 2.5 studs long (the samples: 5.1) and 64 % of its parts are 1 × 1 or 1 × 2 (the samples: 26 %).

Our samples were not changed: their outputs are the same as before. Tools the study asks for that the language still lacks are listed in [TODO.md](../TODO.md).
