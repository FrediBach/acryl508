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
- interactive Three.js case preview with ordered, mix-and-match 1U/3U rows and live dimension and tint controls
- interlocking case panels retained by rail-end screws, with stance and handles integral to the side panels
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
- `npm run lint`: run ESLint
- `npm run doctor`: scan the React codebase for health issues
- `npm test`: build and verify the application contract and output

## Vercel

Import this repository into Vercel with the repository root as the project root.
`vercel.json` selects the Next.js framework, installs from the npm lockfile, and
runs `npm run build:vercel` (Next.js with Webpack) with `.next` as the output directory. No environment
variables are required. The existing `dev`, `build`, and `start` scripts retain
the vinext / Cloudflare Sites workflow.

The page title, description, canonical URL, Open Graph tags, and X card are
defined in `app/layout.tsx`. Absolute sharing URLs use the incoming request host,
so they work on Vercel previews and custom domains without a hardcoded domain.
The 1200 × 630 social card is `public/og.png`; the favicon and Apple touch icon
reuse the stacked-panel brand mark.

## Bottom ventilation

Bottom ventilation in **The details** offers long slits, short slits, round
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

Enable **Patch cable holder** in **The details** to extend the rear plate into
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

## Custom cutouts

Section 05 accepts filled SVG outlines (up to 1 MB), or text from the bundled
Helvetiker / Optimer fonts and imported static TTF / OTF fonts (up to 5 MB).
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
Use stencil lettering when enclosed centres should remain attached.

JSON version 7 includes the ordered 1U/3U row layout, adjustable side-panel margin, each cutout's source metadata, normalized outlines,
placement, and width, plus removal reports and the resolved panel outlines in
millimetres. It remains a design specification requiring fabrication validation.
Font copyrights and distribution licences are retained in the bundled JSON
assets under `public/fonts/`.

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
and warns about incompatible cases or custom-cutout conflicts. Trolley Bus
retains its illustrative preview and adds no mounting holes.
