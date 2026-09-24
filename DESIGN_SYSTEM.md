# A508 design system

A precise, quiet interface inspired by functional industrial design: visible construction,
clear hierarchy, restrained colour, and controls that show what they change.

## Foundations

- Semantic tokens live in `app/globals.css`; `.dark` replaces the palette as a unit.
- Light: warm off-white `#f7f7f2`, graphite `#292b27`, signal orange `#ed6028`.
- Dark: charcoal olive `#1a1c19`, warm white `#e1e4d9`, signal orange `#ff814a`.
- Geist for interface copy; Geist Mono for dimensions, numbering, and technical labels.
- Spacing: 4, 8, 12, 16, 24, 32, 48 px. Borders: 1 px. Corners: 2–4 px.
- Orange denotes a selected parameter or a primary export action. Material swatches
  represent acrylic colour independently of the interface accent.
- Export buttons use a deeper orange `#c44718` with white text in both themes.
- Avoid decorative shadows; reserve them for the product and modal elevation.

## Components and interaction

- Shared button, segmented control, number field, range, swatch, select, switch,
  specification list, and dialog classes use semantic tokens in both modes.
- Theme follows the operating system until explicitly selected; the local preference
  persists across visits. A prepaint script avoids a flash of the wrong theme.
- Camera controls expose perspective, front, top, reset, exploded assembly, example
  modules, and expanded view. Animation is limited to direct manipulation.
- All actionable icons have accessible names; selected controls expose pressed state.
  Native dialogs handle keyboard focus and Escape. Focus rings use the accent token.
- Desktop uses the available viewport height: a 64 px header and a flexible workspace.
  The preview resizes above a compact specification strip; controls scroll independently
  if the screen is too short. Below 850 px height, control spacing becomes denser without
  reducing text size. Below 700 px width, the model, controls, and export summary use
  normal page scrolling in one vertical flow.

The case sidebar uses seven independently collapsible cards: Dimensions, Rows &
stance, Material, Accessories, Ventilation, Power & assembly, and Custom cutouts.
Only Dimensions starts open. Each header keeps a live configuration summary
visible while closed. Native disclosure controls support keyboard interaction;
collapsing a card preserves its controls and edits. Internal groups use spacing
and rules, with additional row angles and ventilation effects behind secondary
disclosures. Disabled ventilation hides its editor while preserving the pattern.
Side-panel edge margin is grouped with sheet thickness under Material.

## Product constraints

The top bar offers Case designer and Synth stand modes. Both share the theme,
material palette and visual controls while retaining independent in-session
configurations. On narrow screens, the mode switch occupies a full second row.
The active mode owns material-library selections, build notes and both exports.

Synth stands use solid support ribs with front stops and three slotted cross
braces, all cut from a single thickness of acrylic. The 220 mm maximum rib
spacing is a layout heuristic. Part counts, dimensions and slot clearance are
live; the UI and exports clearly identify the design as an unvalidated
prototype with no load rating. The 3D model and flat cutting layout share the
exported polygons. Exploded view separates the ribs vertically along the
actual assembly direction. No hardware, adhesive or bent parts are included.

The geometry uses millimetres and the 5.08 mm HP pitch. Every acrylic panel uses
one selected GS sheet thickness. The case is an engineering concept: fabrication
clearances, rail profiles, panel joints, load capacity, and busboard mounting patterns
are not yet validated. Sinusoda and Trolley Bus are board-family preferences, with an
illustrative board preview. JSON export states these limits explicitly.

The five enclosure sheets form a rail-retained tab-and-slot assembly. The base
and both end panels have lateral tongues that enter closed slots in the two side
panels. The slots constrain vertical and fore/aft movement; the rail-end screws
retain the sides against lateral withdrawal. Screws engage the metal rails, with
load-spreading washers against the acrylic. No additional case-panel screws or
glue are part of this concept. Support the case, remove the rail-end screws on
one side, withdraw that side, then remove the base and end panels. The exploded
view separates the mating tabs, slots, rails, and hardware for inspection.

The side-panel retaining margin `m` is adjustable from one to two sheet
thicknesses below the base and beyond each end-panel slot. The one-thickness
minimum places the slot centre 1.5 slot widths from the sheet edge, adapting the
manufacturer's drilled-hole edge-distance guidance as a conservative UI
guardrail; rectangular slots and loaded retention still require prototype
validation. Rows are an ordered rear-to-front mix of 1U and 3U bays. With sheet
thickness `t`, outer dimensions are `HP × 5.08 + 2t` by
`total rack units × 44.45 + 2t + 2m` by `internal depth + t + m` mm. The base
underside is at `m` and its inner surface at `m + t`. This preserves HP, row
spacing, and usable depth.
For angled rows, an extra-angle control for each row behind the front adds to
its neighbour’s tilt. Each bend allows 0–60°, with a maximum cumulative 75°
including the stance. The shared row layout projects each bay into the case’s
length/height, expands the gap at bends, reserves rear rail clearance and keeps
standard rail pitch within a bay. Side rims follow these surfaces, the rear
panel grows with them, and its tabs match the side slots. Integral feet appear
automatically; a flat stance has two contact pads on each side. Preview, board
fit, dimensions and both exports use this same geometry.

The feet, handle, and busboard positions follow the revised enclosure geometry.
Slot widths are nominal sheet thickness, not validated cutting tolerances.
Laser kerf, actual sheet thickness, internal-corner relief, rail threads, screw
engagement, racking, panel flex and loaded retention need fabrication testing.

Optional accessories use the same sheet thickness and tint: one rear handle panel
with a rounded hand opening, and two feet in wedge, arch, or sled profiles. Feet
follow the selected 10°, 20°, or 30° stance; no feet preserves the saved profile.
The summary and JSON export include all acrylic panels (5–8). Displayed case
dimensions describe the enclosure, excluding accessories.

Feet overlap the outside of each side wall and attach with two removable
through-bolts per foot, broad washers, isolating spacers, and locknuts. Matching
clearance holes and the full fastening stack appear in the preview and separate
in the exploded view. No glue or tapped acrylic threads are used. Joint sizes and
loads remain conceptual and require fabrication validation. See the
[Perspex fixing guidance](https://www.perspex.co.uk/Perspex/media/General/technical-library/PDFs/Perspex-Design-Guide.pdf)
and [ACRYLITE hole clearances](https://www.acrylite.co/resources/knowledge-base/article/how-far-in-should-I-drill-a-hole-from-the-edge-of-acrylic-sheet?category=working-with-acrylite-r).

The canvas fills the preview stage so contact shadows are not cropped by an
inset rectangle. Material details remain in the controls and top label; no
material annotation is drawn over the model.

Custom cutouts live in section 07. Each SVG or text item selects one of the five
enclosure panels and has independent width, rotation and X/Y placement. The
flat layout is an outside view: X goes right, Y goes up, and the origin is the
panel centre. Bottom is viewed from below with the rear at the top. Left, rear,
and bottom geometry is mirrored during assembly so lettering reads correctly
from outside. Width scales both axes uniformly. Numeric controls provide a
keyboard alternative to pointer placement. Solid fill is retained material;
dashed orange outlines identify the selected cutout.

The panel geometry is shared by the flat layout, 3D preview, removal reports,
and JSON/SVG exports. The full-size SVG lays out every selected acrylic sheet in
millimetres as a separate named group without adding visible labels to cutting
paths. Subtract all cuts together, including existing ventilation
and mounting holes, before finding disconnected acrylic. Keep the largest
component sharing an edge with the original panel perimeter. Remove every
other component, including enclosed font counters, and show persistent, live
warnings with part counts and area. Report fully removed panels and cutouts
outside the sheet. This policy guarantees connected preview material, not
structural strength or fabrication readiness; the existing concept limits apply.

## Social card

`public/og.png` is a 1200 × 630 social card created with the built-in image-generation
tool using the supplied exploded-view screenshot, then resized for sharing. It shows
the orange case and the existing acryl508 brand lockup. The card is conceptual; the
live model is generated by Three.js, independently of it. `public/favicon.ico`,
`public/favicon.png`, and `public/apple-touch-icon.png` reproduce the header's
three overlapping panel outlines, with an off-white background for contrast.

Final image-generation prompt:

```text
Use case: compositing / ads-marketing.
Asset type: finished Open Graph social sharing card for acryl508, landscape 1200 by 630 pixels (aspect ratio 1.905:1).
Input image 1: product and brand reference. Use the exploded product view from this screenshot as the hero, including its exact orange transparent acrylic panels, two dark aluminium rails, rear handle, wedge feet, washers and black fasteners. Preserve the product's geometry and arrangement as closely as possible. The screenshot UI is not part of the final image.
Create one cohesive social card with a warm off-white background (#f5f5ef), a very subtle engineering grid, and charcoal and signal-orange brand accents. Put the large existing brand lockup at upper left: three overlapping outlined parallelogram sheets (two charcoal, front one orange) followed by exact text "acryl508." in the reference's clean sans serif treatment, "acryl" bold, "508" lighter and the final period orange. Below the name, in smaller charcoal type, write exactly "Eurorack case configurator". The exploded orange case is large and centered in the lower two thirds, fully in frame, with soft studio shadows. Retain ample margins for social-platform cropping. Typography crisp and readable at thumbnail size.
Only those two lines of text. No UI controls, sidebars, navigation, dimensions, labels, browser chrome, watermarks, extra products or invented features. Render the complete card including typography as a single polished image.
```
