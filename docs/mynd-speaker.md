# MYND acrylic enclosure reference

Speaker case is a seven-sheet prototype: baffle, removable rear, top, base,
left, right and an independently spaced dot grille. Default body dimensions
are **280 × 200 × 120 mm** (W × H × D), with 5 mm sheet, a 12 mm grille gap,
3 mm dots and a 5 mm staggered pitch. Total depth includes the grille and gap.
The body is a new design; these are not Teufel's stock enclosure dimensions.

## Provenance

Adapted from [Teufel MYND hardware](https://github.com/teufelaudio/mynd-hardware),
revision `149d002334b0725fba03499079bdaf2e61c8ff36`, retrieved 2026-09-26.
The upstream CAD is licensed **CC BY-SA 4.0**; see
[the included license](mynd-hardware-LICENSE.txt). CAD-derived geometry and
exported enclosure adaptations retain this attribution and share-alike license.
The surrounding application retains its existing license.

Changes: replaced the moulded shell with flat acrylic sheets and butt joints;
added a removable rear with corner tie rods and a spaced dot grille; simplified
seating profiles; proposed service openings and electronics placements.
No Teufel endorsement, acoustic equivalence or weatherproof rating is implied.

## Measured references versus proposed geometry

Source files under `CAD/STP/`:

- `MYND Print parts Baffle.stp`: the woofer's concentric circles are centred at
  source `(X,Z) = (0,66)`. A 43 mm radius seating circle supplies the 86 mm
  opening. Woofer screw centres are `(±38.5373, 66 ±38.5373)`.
- The tweeter seating circles have radius 19.7 mm at `(±93,143.3)`. The resulting
  39.4 mm apertures are **not** the nominal 20 mm diaphragm diameters.
- `MYND Print parts PR Frame.stp` and the baffle place both passive radiators
  about `(±82,72)`. The **50 × 100 mm, R21** windows used here are simplified
  adapter profiles, not traced production gaskets. Each side retains eight
  source screw centres: `|X| = 63,101` at `Z = 22.5,121.5`, and
  `|X| = 52.95,111.05` at `Z = 55,89`. The chosen 3.4 mm through holes are a new
  clearance-hole design, not the donor's pilot-bore diameter.
- `MYND Print parts Port housing.stp`: vertex bounds are approximately
  `X = −114.501…−88.5`, `Y = 27.86…83.86`, `Z = 33.03…70.03` mm.
  The default side window uses the 56 × 37 mm envelope at height 51.28 mm
  above the new body's base. An adapter and gasket are still needed.
- `MYND Print parts HMI cover.stp` has approximately 145 mm span in X.
  The **148 × 24 mm top opening is a proposed adapter**, not a direct projection
  of that cover. It is adjustable independently of the case dimensions.

Source X becomes sheet X; source Z becomes sheet Y after subtracting 90 mm.
The driver layout remains fixed and centred as enclosure width/height changes.
STEP circle centres were resolved through `AXIS2_PLACEMENT_3D` to
`CARTESIAN_POINT`; bounds use `VERTEX_POINT`, not arbitrary spline control
points (which extend far outside the solid). All source units are millimetres.

KiCad `Edge.Cuts` line/arc endpoint envelopes:

| Board file under `PCB_Schematics/KiCad/` | Outline envelope |
| --- | --- |
| `Main/Mynd_Main.kicad_pcb` | 75 × 136 mm |
| `Amp/Mynd_AMP.kicad_pcb` | 90.5 × 57.5 mm |
| `Bluetooth/Mynd_BT.kicad_pcb` | 55 × 41 mm |
| `UI/Mynd_UI.kicad_pcb` | 116 × 26 mm |

These dimensions are board outlines. The preview now includes the actual STEP
component models referenced by each PCB, retaining their footprint positions,
rotations, offsets and top/bottom placement. The repository notes that the KiCad
files were converted from Altium and may contain conversion errors.

## Detailed preview assets

`public/models/mynd/` contains locally served GLBs for all nine released PCBs:
main, amplifier, Bluetooth, UI, USB-C, AUX, battery connector, amplifier connector
and baffle connector. Together they contain **788 referenced component instances**
with no missing model references. Board outlines, mounting holes, pads and line
silkscreen come from the PCB files. Component STEP surfaces are tessellated and
simplified for browser rendering, with display materials assigned for readability.
The original radiator frames, port housing, HMI cover and rubber HMI pad are also
tessellated from the released STEP files. Source geometry is kept at 1:1 mm scale.

The released complete Rhino file contains 17 printable mechanical bodies; it does
not provide the complete electroacoustic drivers or battery pack. The preview's
woofer cone, surround, basket, mounting ears and magnet, tweeter diaphragm and body,
radiator membranes and battery pack are **reconstructed illustrations**, not
manufacturer meshes. Cable paths illustrate routing without claiming electrical
pin assignments. They are hidden in exploded view instead of stretching wires.

`manifest.json` records each input's SHA-256, the pinned upstream revision, PCB
dimensions, mounting centres, model references, mesh bounds and triangle counts.
All models are bundled with their attribution and CC BY-SA license; the running
app never needs to fetch files from GitHub. Rebuild with
`scripts/build-mynd-assets.py /path/to/mynd-hardware` in a temporary environment
with the packages listed in that script. The importer follows the model-transform
order in [KiCad's STEP exporter](https://docs.kicad.org/doxygen/step__pcb__model_8cpp_source.html):
model scale, negative X/Y/Z rotations, offset, bottom-side flip, footprint rotation
and footprint position, with KiCad's downward Y converted to upward Y.

Board placements in the acrylic shell are proposed arrangements, not the stock
assembly. The main board follows the base, the amplifier/Bluetooth boards follow
the rear, control parts follow the top, port parts follow the left side and driver
parts follow the baffle during explosion. Neither enclosure fit nor cable routing
has been physically validated. The new flat-sheet control/port adapters remain
necessary even though the original pod meshes are now visible.

The assembly preview includes four M3 tie rods, four threaded hex grille spacers,
four grille screws, rear nuts, corner washers, twenty driver/radiator screws and
washers, and PCB standoffs/screws at the source mounting centres. Profiles are
illustrative M3 hardware, not a specified supplier part. Spacers fill the chosen
gap less two 0.5 mm washers; rod reach and screw lengths follow the actual sheets.
Items move with their attachment panels in exploded view and keep their physical
length. Source PCB mounting locations are shown; mounting holes in the enclosure
and required supports are still subject to the proposed internal arrangement.

The manufacturer's [MYND specifications](https://hr.teufelaudio.com/mynd-107002004)
identify one nominal 90 mm woofer, two nominal 20 mm tweeters and a three-channel
Class D amplifier. Reuse the complete donor electronics, protected battery,
passive radiators, port/control assemblies and original wiring.

## Construction and validation still required

Bond five chamber sheets at butt joints; use a perimeter gasket behind the rear
sheet and four M3 corner tie rods, spacers and washers. The dot grille uses the
same corner centres and sits outside the sealed acoustic chamber. Sheet sizing
accounts for each adjoining panel thickness; the rear gasket compression is
not modelled. Apply kerf compensation once in CAM.

The source moulded driver recesses, tweeter clips and board bosses cannot be
reproduced by a single flat cut. **Driver retainers/adapters, board standoffs,
battery restraint and sealed port/control adapters are not supplied by these
cutting files.** Measure the donor, design those fittings and prototype the
sealing and retention before treating the enclosure as fabrication-ready.

Gross volume is the rectangular internal envelope, before subtracting all
hardware and supports. It is not a recovered stock net acoustic volume.
Validate radiator excursion, grille clearance/open area, panel stiffness,
resonance and DSP tuning on the assembled prototype.

Projects store the editable speaker configuration independently, including
per-sheet materials. Older version-1 projects gain speaker defaults. Design
JSON includes source provenance and construction notes; both direct SVG and
fabrication-stock SVG retain upstream attribution and prototype limitations.
