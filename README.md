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
- interlocking case panels retained by rail-end screws, plus removable acrylic feet and handle
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
holes or hexagonal holes at low, medium or high density. Patterns occupy two
bands with a solid centre strip and perimeter. Switching ventilation off keeps
the selected options for later. The preview, custom-cutout editor and SVG
export share the same panel geometry; JSON includes `ventStyle` and
`ventDensity`. Older configurations without these fields use long slits at
medium density. The default case retains the original pattern; compact cases
and dense patterns now adapt to the sheet thickness guardrails.

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
the panel and need review. JSON version 5 includes the full `ventDesign` and
the guardrail policy.

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

JSON version 5 includes the ordered 1U/3U row layout, adjustable side-panel margin, each cutout's source metadata, normalized outlines,
placement, and width, plus removal reports and the resolved panel outlines in
millimetres. It remains a design specification requiring fabrication validation.
Font copyrights and distribution licences are retained in the bundled JSON
assets under `public/fonts/`.

The SVG export places every enclosure sheet and each selected acrylic accessory
in one full-size, millimetre-based document. Parts are separate named groups and
include the resolved slots, mounting holes, ventilation, and custom cutouts. The
paths are concept vectors, not production-ready cutting files; apply verified
kerf, tolerances, corner relief, and hardware clearances before fabrication.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
