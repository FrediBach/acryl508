# Acryl508

A modern foundation for the Acryl508 acrylic Eurorack case creator. It combines
React 19, Vite 8 via vinext, Three.js, React Three Fiber, shadcn, Tailwind CSS 4,
and React Doctor, with production builds for Cloudflare Sites and Vercel.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included

- responsive configurator shell under `app/`
- top-bar Case designer / Synth stand / Synth protector / Panel designer / Art modes with independent configurations, local autosave, and portable project files
- Eurorack blank and DIY panels with component openings, SVG/font artwork, separate cut/engrave exports, alignment and ventilation
- automatic slotted acrylic synth stands with solid ribs, three cross braces, 3D and cutting layouts, and JSON/SVG export
- optional local STL/OBJ fitting for stands and protectors, with units, orientation and angle controls; protectors use a level cover above the posed model and individual contour-fitted feet with broad locating lips
- interactive Three.js case preview with ordered, mix-and-match 1U/3U rows, live dimensions, and optional per-sheet acrylic colors and transparency
- interlocking case panels retained by rail-end screws, with stance and handles integral to the side panels
- individual case-sheet thicknesses (3–6 mm), with matching joint slots, tab reach, ventilation, preview and fabrication stock grouping
- adjustable side-panel retaining margins from the original 2× sheet thickness to a guarded near-flush 1× profile
- bottom ventilation with long slits, short slits, round or hexagonal holes, and three densities
- full-size SVG sheet export with named panel groups, slots, holes, vents, and custom cutouts
- SVG and font cutouts with per-panel placement, uniform scaling, rotation, and automatic loose-part removal
- shadcn component configuration and reusable UI primitives
- optional hosting bindings declared in `.openai/hosting.json`
- React Doctor, lint, build, and server-render smoke checks

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the production build
- `npm run build:vercel`: build with native Next.js for Vercel
- `npm run start:vercel`: serve the native Next.js production build locally
- `npm run typecheck`: check application source independently of generated build files
- `npm run check`: run type checking, lint, build and tests
- `npm run lint`: run ESLint
- `npm run doctor`: scan the React codebase for health issues
- `npm test`: build and verify the application contract and output

## Projects, recovery and history

The project toolbar names the workspace and autosaves all five designers in
IndexedDB after a short pause. Reloading restores the last autosave, including
uploaded meshes and up to ten imported fonts. **Save copy** keeps a named
snapshot; **Open** lists those copies. These saves belong to this browser and
origin, not an account: clearing site data removes them, and another device or
deployment URL has separate storage. Storage errors are shown explicitly.

**Project → Download project** downloads a version 1 `.acryl508.json` file containing all five
editable configurations, source meshes and font bytes. **Import JSON** opens
these files or existing single-designer exports. Single-designer imports replace
only their corresponding design. Legacy exports with custom text retain their
outlines, but their original fonts must be imported again to edit text when font
bytes were not included. New project files retain those fonts. Files are limited
to 80 MB and validated before any live state is replaced. Failed recovery does
not overwrite the saved draft. Download files for portable backups; project
files can contain fonts subject to their own redistribution licences.

Undo and redo retain up to 50 changes, with each pointer drag or slider gesture
as one step. Use the toolbar or Ctrl/Cmd Z and Ctrl/Cmd Shift Z (Ctrl Y also
works). Text fields retain native text undo. Undo returns to the designer whose
settings changed. Opening a project starts a fresh history; history itself is
not persisted. **Save current & start new** first saves a named copy.

Imported fonts are shared between case and panel modes. Appearance-only changes
reuse geometry, and color/transparency edits do not restart uploaded-model
fitting. Panel artwork and component geometry still recalculate when edited.

Each designer has one **Design JSON** and one **SVG sheets / SVG layers** action
in its summary below the preview. Design JSON contains that designer only;
**Project → Download project** backs up the entire workspace, including models
and fonts. The header and build notes do not repeat these export actions.

## Fabrication workspace

Open **Fabrication workspace** below the designer for part dimensions, material
groups, hardware quantities and consolidated geometry warnings. Empty case
panels and failed cutout calculations block SVG export, including programmatic
exports; JSON remains available for troubleshooting.

Enter stock width, height and border/gap in millimetres to arrange the actual cut
outlines on separate sheets. A deterministic shelf layout keeps materials
separate, optionally rotates parts 90°, and never scales them. This is a simple
arrangement, not optimized nesting. Downloads are blocked if any part cannot fit
or the active geometry is unresolved. Each sheet downloads separately, with red
cut paths and a blue engraving group; stock borders and preview guides are not
cut paths.

**Download fit coupon** makes an edge-slot comb and a separate tab from the
selected sheet thickness, comparing 0–0.4 mm clearance and including the active
stand/protector clearance. Slot labels are SVG text in the engraving group.
Insert the tab edge-on; cut with the same material and CAM kerf settings planned
for the final parts. The coupon tests slot fit, not strength or loaded stability.

## Vercel

Import this repository into Vercel with the repository root as the project root.
`vercel.json` selects the Next.js framework, installs from the npm lockfile, and
runs `npm run build:vercel` (Next.js with Webpack) with `.next-vercel` as the output directory. No environment
variables are required. The existing `dev`, `build`, and `start` scripts retain
the vinext / Cloudflare Sites workflow.

Next.js uses `.next-vercel` and `tsconfig.next.json`, while vinext continues to
use `dist` and `.next` route declarations. `npm run typecheck` uses stable
`env.d.ts` declarations and checks source independently of either generator.
CI runs the checks and both production builds, then repeats source type checking.

The page title, description, canonical URL, Open Graph tags, and X card are
defined in `app/layout.tsx`. Absolute sharing URLs use the incoming request host,
so they work on Vercel previews and custom domains without a hardcoded domain.
The 1200 × 630 social card is `public/og.png`; the favicon and Apple touch icon
reuse the stacked-panel brand mark.

## Synth stands

Choose **Synth stand** in the top bar and enter the instrument width, depth,
height and playing angle (0–45°). The standard generator creates solid inclined support
ribs with integral front stops and three full-width half-lap cross braces.
Ribs are added automatically to keep support spacing at or below 220 mm. This
is a layout heuristic, not a strength calculation or load rating.

Choose **Advanced · diagonal** for main support sheets crossing in both
45° directions. Every intersection stays at 90°, so slot width remains measured
sheet thickness plus clearance. Four lower stability braces run in the same two
directions, below the synth. Longer rectangular footprints add repeated main
supports in both families; near-square footprints use one central X.

The full-height sheets follow the instrument tilt and include front stops where
they reach the front. Profiles account for the depth occupied by sheet thickness.
Each perpendicular intersection has complementary half-laps; near sheet ends,
notches open through the edge instead of leaving thin tabs or loose slivers.
Stand family B (supports and braces) slots-up, then lower family A slots-down.
The exploded view follows that assembly order. Cable holes occupy clear bays in
both brace directions; openings are omitted where a bay is too short.
JSON version 6 includes each sheet's family, centre-plane origin, yaw, mating
slots, and cable-hole centres. Preview and cutting exports use those same parts.
Standard remains the default for older configurations.

Stand parts use measured GS acrylic thicknesses (5–10 mm). Enable **Individual
sheet materials** under **Material & fit** to choose each rib and brace’s color,
transparency and thickness, including in diagonal mode and model-fitted stands.
Slot width follows the adjoining sheet thickness plus the selected clearance (0–0.4 mm); slot roots have circular
relief so square shoulders can seat. Joint shoulders have 0.2 mm total vertical
clearance. The front deck is 11 sheet thicknesses above the floor, leaving a
solid web above the 8-thickness-high braces. The footprint extends 30 mm behind
the body. By default, compact front feet end beneath the outer front stops.
Enable **Front extension** under **Playing angle** to add a 5–100 mm toe
(15 mm initial setting), measured horizontally beyond the front stops. Turning
it off retains the selected length. Instrument height no longer automatically
extends the feet; it is measured normal to the synth base for the preview.
The integral front stops remain in both modes. Actual feet and underside
geometry are not modelled.

Perspective, side, top, exploded and optional synth-envelope views use the
same polygons as the cutting layout and exported SVG. JSON includes every
resolved part outline and assembly location. SVG is full-size in millimetres,
with one named group per part and no visible text in the cut paths; the layout
is not stock-sheet nesting. Apply kerf compensation once in CAM. There are no
screws, adhesive or bent parts. Stand the braces slots-up, then lower the ribs
slots-down. These open joints lift apart: remove the instrument before moving
the stand.

In Standard mode, optional **Cable holes in braces** adds one round opening between each pair of
ribs, aligned through all three braces. Requested diameter is adjustable from
8–32 mm (20 mm default); the resolved diameter is reduced if needed to leave
two sheet thicknesses of acrylic to the brace edges and complete slot-relief
envelopes. The controls show the actual diameter and count. Size for the widest
connector, since cables must thread through these closed holes. The option is
off by default, and the holes appear in 3D, the cutting layout and both exports.
JSON includes requested/resolved diameters and brace-local hole centres.

Enable **Rounded edges** under **Material & fit** to round the convex outside
corners of the ribs, front stops and braces. The corner radius is adjustable
from 1–10 mm (3 mm default), locally reduced on short edges to keep fillets
from overlapping. Concave synth-contact corners, slot widths, slot-root relief
and cable holes are preserved. Rounding removes material from the flat cutting
outline; it does not bevel the sheet thickness. The same rounded profiles are
used in both previews and exports. The option is off by default.

Cut a fit coupon and validate the prototype for fit, flex, racking, grip and
tipping before use. The model does not calculate mass, centre of gravity,
material stress or playing forces. Check front controls, feet, vents and cables
against the actual instrument. Manufacturer reference:
[ACRYLITE laser machining guidance](https://www.acrylite.co/resources/fabrication-manuals/laser-machining-acrylite).

`lib/synth-stand.ts` owns the geometry, normalization and exports. The stand
tests check connected parts and mating-slot clearance across 216 extreme
configurations, layout separation and export units. The mode interaction test
checks configuration retention, material targeting and active-mode downloads.

## Bottom ventilation

Bottom ventilation in **Ventilation** offers long slits, short slits, round
holes, hexagonal holes or mixed dots and slits at low, medium or high density.
Choose aligned or staggered rows, and two bands or a full field across the
usable base. Both retain a solid centre strip and perimeter. Switching ventilation off keeps
the selected options for later. The preview, custom-cutout editor and SVG
export share the same panel geometry; JSON includes `ventStyle` and
`ventDensity`. Older configurations without these fields use long slits at
medium density. The default case retains the original pattern; compact cases
and dense patterns now adapt to the sheet thickness guardrails.

**Spaced dots** sets up a sparse staggered full field, inspired by perforated
sheet. **Dots & slits** alternates round holes and short rounded slots. Change
the alternation to every opening, by row or by column. Staggered rows shorten
at the edges to stay inside the border. The existing size and position effects
work with both shapes and layouts; choosing an effect preset preserves the
layout, coverage, density and alternation. JSON stores `ventLayout`,
`ventCoverage` and `ventMix`; missing fields use the original aligned bands.

The pattern editor includes Regular, Wave, Ripple, Weave and Organic starting
points and up to three editable effect layers. Sine, triangle, radial ripple,
smooth seeded noise and taper fields can target length/size or either position
axis. Adjust base size, signed strength, frequency, phase and direction. The
bottom outline preview includes custom cutouts; the 3D view and SVG use those
same outlines. Organic variation is reproducible from the exported seed.

After combining effects, each opening stays inside its own cell. The generator
retains at least one sheet thickness (minimum 3 mm) between vents and across
the centre strip, and twice the sheet thickness (minimum 8 mm) at the panel
border. Density is reduced when needed. Vents near the bounding box of each
custom bottom cutout are omitted with a message; imported shapes may therefore
reserve extra material. These are geometry limits, not certified structural,
thermal or laser-cutting limits. Custom cutouts can still independently weaken
the panel and need review. JSON version 7 includes the full `ventDesign` and
the guardrail policy.

## Stance and handles

The side panels extend down to form the selected wedge, arch or sled stance.
Their contact edges lie on the same horizontal floor at 10°, 20° or 30°;
flat mode keeps the rectangular lower edge. Slots and rail holes remain in the
same enclosure coordinates. Sled openings have tangent circular inner corners
and retain at least 12 mm or 2.5× the sheet thickness on all sides, including the
perpendicular distance to the sloping floor edge. Short, shallow stances stay
solid when this opening cannot fit. No separate feet, grip sheets or attachment bolts
are needed: every configuration has five acrylic panels.

Enable integrated handles to extend one or both sides above the rim. Auto
uses one left-side grip up to 84 HP and below 6U, and a pair for wider or taller
racks. One side / Both sides overrides this choice. Short 1U sides flare above
the rim to retain the hand opening. Handle width is adjustable from 130–240 mm,
and height above the rim from 50–110 mm. These are outer dimensions; the opening
is 32 mm narrower and 36 mm shorter. The default is 160 × 70 mm. Both grips share
the dimensions, with rounded transitions into the side panels. Switching handles
off preserves size and layout preferences. Preview, cutout editor and SVG share the same
outlines. JSON version 7 records the resolved grip count, size and integral stance;
legacy `handle` and `footShape` settings remain supported. Grip strength,
loaded stability and fabrication tolerances still require prototype validation.

## Patch cable holder

Enable **Patch cable holder** in **Accessories** to extend the rear plate into
an evenly spaced row of fingers. The fingers and slits have rounded tips and
roots; each slit is open at the top. Finger height above the rim is adjustable
from 20–70 mm (35 mm by default), and slit width from 3–8 mm (5 mm by default).
Choose a slit that clears the cable but retains its plug. Equal-width fingers
and equal pitch are calculated symmetrically across the available rear width,
with a minimum 14 mm finger width and clearance at both ends. Slit bottoms
stay above the case rim.

The holder is part of the existing rear sheet, keeping the case at five panels.
Preview, rear cutout editor and SVG export share its outline; JSON includes
the settings and calculated spacing. Turning it off preserves its settings,
and older configurations leave it disabled. Enclosure dimensions exclude the
holder extension. Cable fit and loaded finger strength need prototype validation.

## Custom engravings and LED lighting

The case designer’s **Custom engravings** section accepts the same filled SVGs,
text and imported fonts as cutouts, with independent size, rotation, position,
duplication and removal on all five sheets. Engravings mark the outside surface,
keep letter counters, merge overlapping marks, and clip to retained acrylic.
The preview uses a granular, rough frosted finish with a shallow surface relief.
The panel designer uses the same finish for its engraving artwork.

Each case sheet and the panel designer can carry a bottom LED strip. Length,
slot height, bottom offset, light colour and brightness are adjustable. The
strip creates an actual thin through-slot; it is not a depth-controlled groove.
The preview shows the strip seated edge-on, with LEDs facing into the acrylic,
and the engraving emission fades with distance from it. Glow follows the
sheet colour and transparency; opaque sheets transmit very little. These are
appearance approximations, not a photometric or electrical model.

Slots require one sheet thickness of surrounding material and must avoid
existing holes, cuts and accessory bends. Bottom vents reserve space for the
strip. Panel strips also avoid component bodies and the rail reserve. Invalid
slots block fabrication with a correction message. Confirm the chosen strip’s
profile, LED direction, fixings, wiring and power supply against real hardware.

Designs, autosaves and project files preserve both engraving and LED settings;
older files default to neither. Case SVGs export black through-cut outlines and
blue filled engraving groups, with engraved sheets outside-face up so lettering
is readable on rear, left and underside sheets. Packed stock SVGs retain the
separate red cut and blue engrave operations. Assign both operations in CAM.

## Custom cutouts

Section 05 accepts filled SVG outlines (up to 1 MB), or text from the bundled
Helvetiker / Optimer / Allerta Stencil fonts and imported static TTF / OTF fonts (up to 5 MB).
Add up to 20 cutouts, choose front, rear, left, right or bottom, and set each
cutout's width, rotation and centre position in millimetres. Click or drag in
the outside panel view to place it. Text changes take effect with **Apply text**.
Uploads are parsed locally; imported markup is never inserted into the page.

SVG paths, basic shapes, transforms, inline fills and even-odd/nonzero fill
rules are supported. Convert strokes and text to filled paths first. Flatten
symbols, clipping paths, masks and images; unsupported features produce an
error instead of silently changing the design. Curves are sampled for the
concept preview. These are not laser-ready cutting paths.

All custom cuts are subtracted together with existing slots and holes before
connected pieces are checked. Only the largest piece sharing an edge with the
original panel perimeter is kept. Detached pieces and enclosed letter centres
are removed, even if an island is larger than the remaining frame. Warnings
report removed pieces, cuts outside the panel, and panels with no material left.
Choose the built-in **Allerta Stencil** font when enclosed letter centres should
remain attached.

JSON version 9 includes per-row angle increments and the resolved row geometry, automatic integral feet, the ordered 1U/3U row layout, adjustable side-panel margin, optional individual panel tints, each cutout's source metadata, normalized outlines,
placement, and width, plus removal reports and the resolved panel outlines in
millimetres. It remains a design specification requiring fabrication validation.
Font copyrights and distribution licences are retained in the bundled JSON
assets and `allerta-stencil-OFL.txt` under `public/fonts/`. Allerta Stencil is
bundled from the [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/allertastencil).

The SVG export places all five enclosure sheets, including the integral stance
and grip outlines, in one full-size, millimetre-based document. Parts are separate named groups and
include the resolved slots, mounting holes, ventilation, and custom cutouts. The
paths are concept vectors, not production-ready cutting files; apply verified
kerf, tolerances, corner relief, and hardware clearances before fabrication.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## Sinusoda Juice

Selecting **Sinusoda Juice** places one centred, unrotated 226 × 86 × 19 mm
board in the case. These overall dimensions, 23 Eurorack headers (2 × 8 pins
at 2.54 mm pitch), 28 mounting holes, and the recommendation for at least 14
evenly distributed screws with nylon washers come from
`docs/sinusoda_data_sheet_juice_v23_2.pdf`, pages 1–2. The document itself
identifies the board as v22.4 and the data sheet as version 1.0, December 2022.

**The PDF contains no dimensioned mounting drawing.** With the user's approval,
the hole pattern is estimated from its top-view photograph (Figure 1), scaled
to the published envelope. The centred coordinates in millimetres are every
combination of X = −103, −68.7, −34.3, 0, 34.3, 68.7, 103 and
Y = −39, −20, 20, 39. X runs right and Y toward the rear when viewed from above;
the underside editor mirrors X. The 3.2 mm hole diameter, board notches,
component envelopes, 1.6 mm PCB thickness and 5 mm standoffs are assumptions.
They require measurement against the actual board before fabrication.

The model, bottom preview and SVG share this pattern. Vents retain at least
one sheet thickness around each mounting hole. Custom cuts approaching the
mounts trigger a warning based on their bounding boxes. The board is never
scaled to fit: cases below 226 mm internal width or 86 mm internal row length
omit the board and its holes and show a warning (minimum 45 HP and 2U total).
The space above the board subtracts its 19 mm height and the assumed 5 mm
standoffs; it is not a validation of individual module or cable fit. The Straw
input module and its cabling are not modelled. JSON records the source,
assumptions, fit and hole coordinates; SVG describes the approximate pattern
and warns about incompatible cases or custom-cutout conflicts.


## Befaco Trolley Bus

The Trolley Bus model uses [Befaco’s product specifications](https://www.befaco.org/trolley-bus/),
[setup manual](https://www.befaco.org/docs/Trolley_bus/Assembled_Trolley_Bus_User_Manual.pdf),
and [top-view photo](https://www.befaco.org/wp-content/uploads/2023/05/troleybus_top_web.png).
The page specifies 423 × 80 mm, 28 horizontal connectors, 25 mm height over
the regulator cover and 15 mm elsewhere. The manual’s installation drawing
labels 435 mm with its arrow extending to the projecting connector. The model
therefore uses a 423 mm board and a conservative 435 mm installation envelope,
interpreting the extra 12 mm as a connector projection on the right. This is
an inference, not a verified mechanical dimension. Fit checks require at least
86 HP and 2U total; an 84 HP case is too narrow for that installation envelope.

Befaco supplies adhesive PCB fasteners. At the user’s request this configurator
instead models an **approximate screw-mount adaptation** using the eight PCB
mounting points visible in the photo, excluding the two regulator-cover screws.
PCB-local centres (mm) are all combinations of X = −207.5, −119, 0, 207.5 and
Y = −24, 24. These columns are intentionally unevenly spaced. The PCB is shifted
6 mm left to centre the complete connector-inclusive envelope on the base;
case mounting holes receive that same translation. In the bottom outside view,
X is mirrored, as for all other bottom geometry.

Hole centres, Ø3.2 mm screw clearance, 60 mm bare PCB depth (80 mm including
headers), 1.6 mm PCB thickness, 5 mm insulating standoffs and component positions
are estimates or preview assumptions. Verify the mounting adaptation, fasteners,
insulation and physical dimensions before drilling. The separate 4HP/3U ON/OFF
module and its cabling are not modelled or reserved. The preview shows the red
PCB, two rows of 14 outward-facing connectors, four DC converters and the red
vented cover. It never scales the board down to fit.

The bottom, preview and exports share all eight translated mounting points.
Vents reserve one sheet thickness around each hole; nearby custom cutouts are
flagged using their bounds. JSON and SVG record the dimensional discrepancy,
mounting assumptions, and omission of mounting holes when the board cannot fit.

## Konstant Lab CompactPWR

Select **CompactPWR** for one centred 174 × 79 × 20 mm board with two rows of
10 vertical IDC headers, rotated 180° so the power connector is on the case's
left near the inlet. The symmetric mounting-hole pattern is unchanged.
Dimensions use the manufacturer's explicit **SIZE**
specification and manual, rather than the rounded 18 × 8 × 2 cm shop field.
References: [product page](https://konstantlab.audio/shop/compactpwr-35w-eurorack-power-supply/),
[manual](https://konstantlab.audio/shop/compactpwr-35w-eurorack-power-supply/?attachment_id=2571&download_file=5c8534d9f9f22),
and [top photo](https://konstantlab.audio/wp-content/uploads/2025/03/CompactPWR2.jpg).

The manual supplies no dimensioned board mounting pattern. Four corner mounts
are **photo-derived estimates** at X = ±83 mm, Y = ±34.5 mm from the PCB/base
centre (166 × 69 mm pitch), with X right and Y toward the rear viewed from
above. The underside editor mirrors X. Ø3.2 mm screw holes, 1.6 mm PCB thickness,
5 mm insulating standoffs, washers and component envelopes are assumptions.
Verify these against the physical board and supplied hardware before drilling.
The separate inlet drawing must not be used as a board mounting template.

The preview shows the black PCB, 20 headers, converter blocks, red input choke,
capacitors, trimmers and orange/grey input terminal. It stays at full size and
requires at least 35 HP and 2U total. Preview and bottom holes are omitted when
it cannot fit. Clearance above the board deducts its 20 mm height and assumed
5 mm standoffs.

Selecting CompactPWR also adds a 45 × 25 mm clearance window and two Ø3.5 mm
screw holes at 59 mm pitch. **Inlet panel** selects the left side (low toward
the rear, the default for older projects) or the back panel (low toward the
case's left side, as viewed from the front). Both placements start near the
rear-left corner while preserving the full plate and joint clearance.
The choice is saved with the case and moves the preview, cutouts, export notes
and custom-artwork protection together. The
[manufacturer inlet drawing](https://konstantlab.audio/shop/compactpwr-35w-eurorack-power-supply/?attachment_id=2502&download_file=5c8534a4f9f21)
specifies the 70 × 40 mm barrel/switch faceplate and screw pattern. The clearance
window is a design allowance, not a published cutout dimension; verify the rear
component envelope against the assembled inlet before fabrication. The whole
plate plus a sheet-thickness border must fit clear of joints and rail holes;
otherwise inlet cuts are omitted with a notice. Custom artwork overlapping this
reserved area blocks cutting export. Preview and SVG use the same inlet cuts.
The 3D preview includes the rounded black 1.5 mm faceplate, rocker switch,
barrel socket and two mounting screws. It faces outward on the selected panel
and follows that sheet in exploded view. Front openings follow the drawing;
component depths and fastener details are illustrative rather than CAD data.
USB-C inlet geometry, internal component clearance and cable routing are not modelled.

All four mounts share their coordinates with bottom geometry and exports.
Vents retain a sheet-thickness web around the holes, and nearby custom cuts
trigger a warning. JSON and SVG retain the source, estimates and fit limitations.

### Angled case rows

Each row behind the front row has an independent extra-angle control. Increments
accumulate from front to rear and combine with the overall stance, capped at 75°
from the table (at most 60° per bend). The front row remains the stance reference.
Zero increments preserve the original flat layout; older configurations default
to zero. Row size changes preserve angles, and moving/removing rows updates both.

Rails retain their standard pitch within each bay. Each bend adds a compact gap:
one-third of the combined base clearance (8 mm or two sheet thicknesses) and
rotation allowance; the rear panel
also reserves space for the tilted rail. The shared geometry reshapes the side
rims and rear panel, places matching rail holes and end-panel slots, and updates
case dimensions, board fit, the 3D preview, and JSON/SVG exports. Integral feet
are automatic for angled layouts, with four contact pads at a flat stance.
The enclosure remains five acrylic sheets. As elsewhere in the designer, actual
module depth, rail profiles, joint fit and loaded stability need prototype checks.

## Acrylic colors and transparency

Both designers and the material library offer the shop’s eleven color families:
Colorless, Black, White, Grey, Orange, Red, Yellow, Blue, Green, Umber and Brown.
The chooser uses English throughout. Orange retains the original signal orange;
yellow uses a warmer golden shade to better match the actual sheets.
Color and transparency are independent; the case can also set both per sheet.
Applying a color to all sheets preserves their transparency choices and vice versa.
The four transparency presets are See-through, Opaque, Milky, and Fully transparent. Their shared physical-material renderer varies
transmission, roughness and absorption. Milky acrylic uses thickness-dependent
rough transmission with a smoother surface reflection, preserves the selected
pigment, and softens the preview’s edge lines. Bulk scattering is approximated,
not simulated volumetrically. These are appearance
approximations, not measured supplier properties or a stock availability matrix.
JSON exports retain `transparency` and optional case `panelTransparencies`; older
configurations without these fields default to fully transparent.

## Synth Protector

The third designer mode creates an oversized top sheet with edge-locating feet. Enter synth width, depth and body height, then choose body-to-sheet clearance (15–120 mm), overhang (20–60 mm per edge), foot positions and side fit gap. Feet rest on clear, level top edges with short locating lips outside the synth; they do not reach the desk. The design assumes a rectangular body.

Support the left/right edges or all four edges. Add intermediate feet separately for each left/right edge (up to 6 extra) and each front/rear edge (up to 8 extra); actual limits depend on available space and sheet thickness. Feet are evenly distributed between the end feet. Minimum corner inset prevents perpendicular feet and strip heads colliding, and minimum spacing retains material between cover slots.

Optional locking strips extend every foot tab above the cover and cut a rectangular pass-through hole. One horizontal acrylic strip per supported edge threads through all its tabs. The widened trailing head stops insertion; withdraw each strip before disassembly. Strips prevent feet dropping out vertically but remain removable sideways, so their fit and retention need prototype testing. Enable **Individual sheet materials** under **Material & construction** to choose the cover, each foot and each retaining strip’s color, transparency and thickness (5–10 mm). Cover slots follow each foot’s thickness, tab heights follow the cover, and pass-through holes follow the matching strip. Slot-fit clearance applies throughout.

Perspective, side, top, exploded and cutting-layout views share polygons with the full-size SVG and version 2 JSON exports. Exports include every foot and retaining strip, resolved counts, orientations, retention geometry and assembly notes. Each designer mode retains independent configuration and material choices during the session. The prototype has no validated load or impact rating; extra edge supports do not support the centre of the sheet. Check contact surfaces, keys, connectors, fit, internal corners and sheet flex before fabrication.

## Panel designer

The fourth mode makes one flat Eurorack blank panel or DIY module faceplate.
Choose 3U (128.5 mm), Intellijel 1U (39.65 mm), or Pulp Logic 1U (43.18 mm).
Widths range from 2–84 HP; Pulp Logic uses 6–84 HP in multiples of six.
Actual width is HP × 5.08 mm minus a configurable total clearance of 0.1–0.5 mm
(0.3 mm default). Acrylic thickness is 1.5–6 mm (3 mm default).

Mounting positions follow [Doepfer’s construction details](https://www.doepfer.de/a100_man/a100m_e.htm),
[Intellijel’s dimensioned drawing](https://intellijel.com/support/1u-technical-specifications/),
and [Pulp Logic’s tile drawing](https://pulplogic.com/1u_tiles/).
3U and Intellijel hole centres are 3 mm from top/bottom and start 7.5 mm from
the left. Pulp Logic uses 0.118 inch (2.9972 mm) vertically and 0.200 inch
(5.08 mm) from the left. Right columns stay on the HP grid: (HP − 3) × 5.08 mm
from the left column for 3U/Intellijel, (HP − 2) × 5.08 mm for Pulp Logic.
Automatic mounting uses two holes below 12 HP, four from 12 HP, and four for
Pulp Logic. Two/four overrides are available; panels below 4 HP retain two.
Openings are 3.2 mm (3U/Intellijel) or 3.175 mm (Pulp Logic). Horizontal slots
add 0–4 mm travel, reduced near side edges to retain a 0.5 mm minimum web.
That narrow web is a geometric limit, not a strength rating.

Add jack, pot, switch, display or custom openings. Presets are examples, not
manufacturer dimensions. Edit round holes, rounded rectangles and slots,
position and rotation, component body clearance boxes, and maximum permitted
panel thickness (0 means unspecified). The model flags edge/rail conflicts,
body-box overlaps, mounting interference and thickness mismatches. Body boxes
use conservative rotated bounding boxes for collision checks. An 8 mm top and
bottom rail reserve is a planning assumption; actual rails and hardware vary.

The front editor supports pointer dragging, grid snapping (0.5, 1, 2.54 or
5.08 mm), arrow-key nudging, Shift-click or checkbox multi-selection, alignment,
even centre distribution, group centring, duplication and deletion. Shift with
an arrow moves ten steps. Coordinates use the panel centre, X right and Y up.
Numerical fields permit exact positioning independently of grid snapping.
Perspective uses the same resolved sheet geometry and surface artwork.

Import filled SVG up to 1 MB or add text with bundled fonts / static TTF and OTF
up to 5 MB. These reuse the case designer’s local parsers and font outlines.
Each artwork selects Cut through or Engrave surface; engraving is the default.
Cutting removes disconnected islands after all openings are subtracted.
Engraving retains letter counters and is clipped to the remaining acrylic.
Artwork is uniformly scaled and can be moved or rotated. Up to 64 component
openings and 20 artworks are supported. Designs and imported fonts are retained
while switching modes and are included in autosaved workspaces and downloadable project files.

Ventilation offers circles, short rounded slits and hexagons, aligned or
staggered rows, adjustable size/pitch/border, and the shared Regular, Wave,
Ripple, Weave and Organic effect presets. The border is at least two sheet
thicknesses; vent-to-vent spacing is at least one thickness or 2 mm. Openings
avoid mounting holes, component body boxes and artwork. Pitch increases if
needed to limit the candidate pattern to 600 openings for interactive editing.
The controls and JSON report the resolved pitch, margin and opening count.

SVG is full-size in millimetres with `cut` (red outlines) and `engrave` (blue
filled outlines) groups. It contains the same cut and engraving paths as the
cutting preview; guides, dimensions and component body boxes are excluded.
Assign operations in CAM and apply kerf once. JSON version 1 records source
artwork, editable settings, resolved geometry, mounting data and warnings.
SVG export is disabled for empty panels or failed geometry calculations.
Curves are sampled, not exact analytic arcs. Prototype the mounting webs,
material flex, hole fit, washers and component thread engagement before use.
Acrylic panels do not provide metal-panel electrical shielding.

### Fit a synth stand to a 3D model

In **Synth stand → Your instrument**, optionally choose an STL (binary or ASCII)
or OBJ file, up to 15 MB and 30,000 triangles. Files are parsed locally and included in browser autosave and downloaded project files. Set the source units (mm, cm, m or inches), up
axis and quarter-turn orientation; confirm the resulting dimensions, then set
the playing angle. Removing the model restores the manual dimensions.

Both standard and diagonal layouts fit every main support to the model's lower
surface across the full acrylic thickness, including narrow feet and changes
across the object's width. Geometry is calculated in a cancellable background
worker. The preview displays the actual mesh in the same pose used for fitting;
SVG and JSON use the resolved cutting geometry. JSON also includes the source
mesh and orientation. Exports are blocked while fitting or when fitting fails.

The compact footprint reserves two sheet thicknesses in front of the tilted
mesh (three in diagonal mode) for integral retaining lips, and one at the rear.
The optional front extension adds to that footprint; turning it off retains the
lips. Each front-reaching rib gets a lip backed outward from the mesh's actual
front contact boundary, with at least two sheet thicknesses of material before
rounding. Its height is capped at 18 mm above the local underside, or 60% of the
model's unrotated height for thin objects. The full sheet thickness is considered
when clearing the mesh. Side-ending diagonal ribs retain their underside fit.

Model dimensions must be 60–1400 mm wide, 40–1000 mm deep and 1–1000 mm tall.
Triangle projections are resolved to 0.0000001 mm to stabilize shared edges.
Other thin contact fins are trimmed to blunt ends. Optional rounding softens
convex contact corners, and joints are cut into the complete fitted outline
only after shaping, so their fit stays independent of the lip and contour.
Regions without a model surface stay at tie height except for the intentional
front lips. JSON records the lip positions and heights. Fit is only as accurate
as the source mesh and its units. Check vents, balance, surface grip, retention,
joint fit and strength on a prototype; no load rating is calculated.

### Fit a synth protector to a 3D model

In **Synth protector → Your instrument**, upload an STL/OBJ and set its units,
up axis, orientation and object angle. The cover stays horizontal above the
highest posed mesh point, with the chosen clearance and overhang. Individual
feet follow the upper surface across the full sheet thickness. They retain
broad outside locating lips while downward needles are trimmed away. Overhang
increases when necessary to leave two sheet thicknesses outside the model.

Foot inset and additional feet remain adjustable. Cover slots and optional
retaining-strip holes stay aligned despite different contact heights. Fits
with missing contact surfaces or overlapping feet block export and explain
which settings to adjust. Preview and SVG/JSON share the fitted outlines;
JSON includes the model and pose. Models and manual settings are independent
between stand and protector modes. Inspect contacts around keys, knobs and
other delicate surfaces: the mesh does not identify suitable bearing points.

## Art mode

Art mode creates a decorative slotted grid with one leaf per sheet. Growth
height, height variation, centre crown and a deterministic pattern seed control
the silhouette. Optional outward bends have angle, location and variation
sliders. Every sheet can override height, bend angle and bend location; resetting
an override returns it to the generator. A new seed preserves overrides.

Enable **Leaf shelves** under **Outward bends** to add a rounded small leaf
pointing inward at 90° to the bent section of its parent, just after each bend.
Adjust shelf width and depth; rectangular tabs cross the parent perpendicularly,
and matching closed slots fit shelf thickness plus clearance. Shelves inherit
the parent leaf’s color and transparency, with independently adjustable thickness.
They appear in the 3D
preview, exploded view, cutting layout, JSON/SVG and fabrication stock sheets.
Straight leaves have no shelf. If a leaf is too narrow or its bend too near the
tip, its shelf is omitted with a note explaining which settings to adjust.
Assemble and form the main leaves before inserting shelves. Tab retention,
flex and loaded stability require a physical prototype; no load rating is given.
The option defaults to off, including when opening older projects.

The two sheet families have 2–10 sheets each, in pairs, leaving a clear central
bay. Footprint is 120–600 mm per side, automatically enlarged when density and
material thickness need more room. The root grid is eight sheet thicknesses high
and uses complementary half-lap slots with 0.2 mm vertical relief. Leaves remain
clear of the perpendicular sheet family above the root grid; bends begin above
the joints. Previewed curves and developed flat patterns share the existing bend
model: inside radius twice sheet thickness, neutral axis at mid-sheet.

Enable **Individual sheet materials** under **Grid & material** for per-sheet
color, transparency and thickness (3–6 mm). Slots follow the adjoining sheet,
and bend allowance follows each leaf’s own thickness. Structural spacing uses
the largest configured thickness.

Across art, stand and protector modes, material choices survive switching modes,
toggling individual materials off and on, undo/redo, and project saving. Global
material controls apply to all sheets while individual materials are enabled.
JSON and SVG exports identify each sheet’s material and thickness; fabrication
stock packing separates different materials and thicknesses.

Art reuses acrylic color, transparency, measured thickness, slot clearance,
3D orbit/side/top and exploded views, cutting layout, fabrication stock packing,
fit coupons, JSON/SVG exports, project saving, autosave and undo/redo. Older
projects acquire the default art configuration when opened. Design SVG separates
red cut paths from blue dashed bend-start guides. Stock SVG contains cuts only;
part-specific forming instructions remain in the fabrication warnings and JSON.

Assemble B slots-up and A slots-down before forming the leaves outward. This is
a decorative prototype: forming sequence, fit, flex, leaf collisions and tipping
stability need physical validation. Collision and load simulation are not included.
