# MYND acrylic enclosure reference

Speaker case is a nine-sheet prototype: baffle, removable rear, top, base,
left, right, an independently spaced dot grille, and two internal PCB carriers.
Default body dimensions are **280 × 210 × 120 mm** (W × H × D), with 5 mm sheet, a 12 mm grille gap,
3 mm dots and a 5 mm staggered pitch. Total depth includes the grille and gap.
The body is a new design; these are not Teufel's stock enclosure dimensions.

## Live dimensions and sound comparison

Under **Enclosure**, **Dimensions & sound** updates directly with width, height,
depth, sheet thickness and gasket spacing. The reference starts at the default
acrylic case: 270 × 200 × 110 mm inside, or 5.94 L gross. It is not the original
MYND cabinet. **Use current as reference** pins a comparison for the current
view; **Use default** restores the default. Pinning does not change the design.

The bass chart shows the relative resonance of an ideal fixed mass on the
enclosure air spring: `f / f_ref = sqrt(V_ref / V)`. This follows from acoustic
compliance `C = V / (rho * c²)` and the constant-mass oscillator relation. It
omits passive-radiator suspension and losses, driver coupling and DSP, so the
index is an air-spring tendency, not the MYND tuning frequency, F3, SPL or an
on-axis frequency response. See [COMSOL's volume-compliance model](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.031.html).

Three separate markers show the first axial standing-wave frequency across
each internal dimension: `f = 343 / (2 * length_in_metres)`. This assumes an
empty rectangular enclosure with rigid walls. It predicts locations rather than
peak amplitudes; carriers and hardware are omitted. Equal-volume enclosures can
therefore have the same bass index and different standing-wave markers. See
[COMSOL's rectangular-cavity analytic comparison](https://doc.comsol.com/6.4/doc/com.comsol.help.models.mph.eigenmodes_of_room/eigenmodes_of_room.html).

**Assumptions & air volume** accepts 0–4 L of estimated hardware/bracing
displacement, subtracted equally from current and reference gross volumes.
Zero explicitly uses gross volume; no measured donor displacement is assumed.
This setting is saved with the design. JSON exports include the calculated
comparison against the default acrylic case, its assumptions and source links.
The pin is a temporary view setting. Feet, handles and the external grille do
not affect this model. Gaskets affect nominal depth only; panel vibration,
gasket damping, absorption, diffraction and leakage are not simulated.

A measured frequency-response prediction would require verified driver
parameters, passive-radiator mass/compliance, net air volume and DSP settings,
followed by prototype measurements.

## Optional joint damping

The **Joint damping** control adds two dark, one-piece frames between the shell
edges and the front baffle / removable rear. It defaults off; sheet thickness is
adjustable from **0.25–2 mm**, initially 1 mm. The frames follow the individual
side, top and base thicknesses, with a 0.35 mm setback on each side of the narrow
contact strips. Rounded corner tabs surround four Ø3.6 mm locating holes at the
tie-rod centres. The large centre stays open and clears the donor apertures.

The bonded shell and electronics retain their dimensions and positions. Each end
panel moves outward by one gasket thickness, the grille and drivers follow the
baffle, and the tie rods grow by twice that thickness. Body depth, overall depth
and gross chamber volume include the nominal gasket spacing. With damping
enabled, clamp the front baffle against its gasket instead of bonding it to the
shell; the sides, top, base and internal carrier joints remain bonded.

Assembled and exploded previews show both layers. Design JSON and SVG include
the two gasket patterns; Fabrication groups them on separate **Dark damping
sheet** stock, never on acrylic stock. The selected thickness is nominal: material
compression is not simulated. Verify compressed fit, sealing and rod engagement
in the prototype. Joint damping is not internal acoustic lining, and no acoustic
attenuation is predicted.

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
- `MYND Print parts Port housing.stp`: the flange spans 56 mm across source Y.
  The side-sheet cut now follows its **central access wire at source X = −114.5**,
  sampled with 0.03 mm chord tolerance, rather than cutting out the flange envelope.
  Its bounds are approximately **40.991 × 20.089 mm**. Source Y/Z mounting axes
  are `(31.36,51.28)`, `(80.86,51.28)`, `(54.36,37.03)`, `(54.36,66.03)`.
  The side bores are Ø2.6 through a 2 mm flange; the recessed top/bottom bores
  are Ø3.5 through source X = −107.5…−105.5 (7 mm recess, 9 mm total depth).
  New sheet cuts are Ø2.8 for M2.5 and Ø3.4 for M3. The preview proposes through
  screws, backing washers/nuts and two 7 mm sleeves in the recessed mounts.
  The flange sits against the inner sheet face; the opening, holes and housing
  share their source datum even with mixed sheet thicknesses and exploded view.
  `scripts/extract-mynd-port.py` reproduces `lib/mynd-port.ts` from that STEP.
  Old adjustable rectangular port dimensions normalize to the fixed donor profile.
  These are proposed flat-sheet fasteners, not a verified donor fastening method;
  verify access, sealing, tolerances and nut clearance on the physical assembly.
- `MYND Print parts HMI cover.stp` has approximately 145 mm span in X.
  The top now keeps acrylic between individual controls: **three Ø18 mm circles**
  at source X = −49, −23, 3, plus a **38 × 18 mm capsule** centred at X = 39
  for the combined volume rocker (end centres X = 29, 49). All button axes are
  at source Y = 56.17 (scene Z = 1). STEP collar radii reach approximately
  8.54 mm; R9 holes provide about 0.46 mm radial clearance.
  `lib/mynd-controls.ts` shares these dimensions and the assembly seating datum.
  Non-button rubber reaches source Z = 165.789; the inner acrylic face is set
  at source Z = 166 to keep the backing below it. The cover and UI board move
  together, using 7.1 mm cover supports. Buttons remain recessed with thicker
  acrylic; verify finger access, button travel and sealing on the donor.
  Old rectangular control-opening settings normalize to the fixed 116 × 18 mm
  overall button-cutout footprint.

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
PCB and pad faces use separate vertices from their edge walls, keeping the flat
surfaces evenly shaded while curved outlines and holes retain smooth side normals.
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
assembly. The main board follows the internal floor, the amplifier/Bluetooth boards follow
the internal backplate, control parts follow the top, port parts follow the left side and driver
parts follow the baffle during explosion. Neither enclosure fit nor cable routing
has been physically validated. The control and port openings now follow the donor geometry; sealing and
physical fastening still require validation.

The assembly preview includes four M3 tie rods, four threaded hex grille spacers,
four grille screws, rear nuts, corner washers, twenty driver/radiator screws and
washers, and PCB standoffs/screws at the source mounting centres. Profiles are
illustrative M3 hardware, not a specified supplier part. Spacers fill the chosen
gap less two 0.5 mm washers; rod reach and screw lengths follow the actual sheets.
Items move with their attachment panels in exploded view and keep their physical
length. The 19 source PCB mounting coordinates now cut **two internal sheets**:
ten Ø3.4 mm holes in `pcb-floor`, nine in `pcb-rear`. The amplifier sits on
the right of the floor, alongside the main board (shifted 45 mm left). Its
`P2A` socket receives the `P2S` right-angle header on `Conn_Amp`; the bridge's
`P1S` contact mates with `P1X` on `Conn_Baffle`. These are a rigid board-to-board
connection, not a cable or a separately screwed bridge. The baffle connector
is supported from the backplate, clear of the battery, on approximately
48.84 mm standoffs. Main-board depth centres between that backplate and the baffle.
Connector locations and header seating faces follow the pinned KiCad/STEP
files; the nominal **10 mm spacing** between the two contact boards remains a
preview assumption. Measure the donor's spring-contact engagement before
fabricating supports. The bridge moves with the amplifier/floor in exploded
view, separating from the baffle connector on the backplate. The illustrative
amp-to-baffle cable has been removed; the driver cable now ends at `P2X`.

All nine PCB substrates use red solder mask, matching the donor photograph.
Pads, silkscreen and component materials retain their separate colors. The
asset generator uses the same red material as the shipped GLBs.
The main board is turned 180° on its floor so its taller front-edge components
face away from the woofer. The minimum body height increases to 210 mm for
the raised electronics; older compact designs normalize to this height. Control and port pods retain their own
mounting positions. Board-side and carrier-side fasteners follow the carriers
in exploded view.

The floor underside sits 15 mm above the exterior base, or at least 5 mm above
the inner bottom face, whichever is higher, clearing the lower corner tie rods.
The main board uses 9 mm standoffs (about 3 mm beneath its lowest components).
The backplate sits 5 mm ahead of the inner rear face and stops 12 mm below the
inner top to clear the upper tie rods. A 0.5 mm washer plus 3 mm cap head leaves
at least 1.5 mm clearance inside each gap. Neither PCB mounts nor tabs penetrate the outer bottom. Four
flush tabs per carrier enter closed rectangular slots in the side sheets, using
the Eurorack case's tab-and-slot construction principle. Tab length follows the
receiving side's thickness; slot thickness follows the carrier. The nominal
paths are uncompensated: prototype the fit and apply kerf compensation once.
Bond and seal these joints to preserve the acoustic chamber. Two floor openings
and a lower backplate window provide wiring/air paths. Carrier removal requires
disassembling bonded joints; boards remain screw-serviceable through the rear.

The top has eight Ø3.5 mm HMI-cover mounting holes at X = −66, −22, 22, 66 and
scene Z = ±22 mm. Source seating faces are Z = 156.4 / 158.9 mm; the proposed
supports span 7.1 mm to the inner top face. The shell, two carriers, fasteners,
exploded view, individual material settings and exports share these dimensions.
All nine sheets are included in SVG and fabrication packing. Placement, cable
reach, battery restraint, sealing and physical clearance remain prototype checks.

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
battery restraint and port/control sealing gaskets are not supplied by these
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

## Optional integral feet

Speaker feet are off by default. The enclosure controls offer the same **Pads,
Arch and Runners** profiles as the Eurorack case, with 8–30 mm height (15 mm by
default). Both sides reuse `flatFeetBottomEdge`; no extra parts or screws are
added. Feet grow below the body, preserving all driver, PCB, joint and port
positions. Enabled sides extend to the exterior base, and the base width fits
between their inner faces to avoid overlapping solid acrylic. Disabling feet
restores the original bottom and side cuts. Curved outlines are sampled into
shared polygons, so preview, SVG and fabrication packing use the same geometry.

Overall height includes the feet; the stated body height and chamber volume do
not. The floor shadow and camera framing follow the foot height. Settings persist
in speaker/project JSON, with older designs retaining their original flat base.

## Optional integral handles

**Handle bend angle** matches the Eurorack case control: **0–90° outward**, with
0° retaining the original straight profile. Left, right and paired handles use
the same angle; each side uses its own acrylic thickness for the forming radius.
The shared bend model uses a 2× thickness inside radius and a mid-thickness
neutral axis. The bend starts one sheet thickness above the enclosure rim.
Flat patterns include that clearance and the developed arc allowance; the same
root trim as the Eurorack handle retains a two-thickness web below the grip and
the original opening size and 16 mm top rail.

The 3D preview shows formed handles, including in exploded view. Overall width
and height, and camera framing, include their actual outward reach. Body joints,
donor mounting holes and chamber volume retain their original positions and
dimensions. Design JSON includes the local bend start, allowance, radius and
angle in each affected part. Design SVG adds blue dashed start/end guides;
Fabrication stock sheets contain flat cuts only, with forming notes listed
separately. Old projects acquire a 0° bend. Validate forming and carrying strength
on a sample before using the handles under load.

Handles default to off, with left, right or both sides available. Width is
100–240 mm (default 160 mm) and rise is 50–110 mm (default 70 mm).
`createSideProfile` supplies the Eurorack case’s same rounded roots, upper
corners and grip opening, combined with the selected feet in one side sheet.
The top nests inside each extended side; asymmetric layouts compensate the
control cutouts and mounting holes to preserve their original world positions.
Ports, PCB carriers and donor hardware do not move. No extra parts are added.

Preview framing, cutting layout, stock packing and exports include the full
handle envelope, including grips wider than the case depth. Body dimensions
and chamber volume remain unchanged. Legacy projects retain handles off.
Carrying strength and bonded joints still require physical prototype testing.
