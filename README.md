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
- interactive Three.js case preview with live dimension and tint controls
- interlocking case panels retained by rail-end screws, plus removable acrylic feet and handle
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

JSON version 2 includes each cutout's source metadata, normalized outlines,
placement, and width, plus removal reports and the resolved panel outlines in
millimetres. It remains a design specification requiring fabrication validation.
Font copyrights and distribution licences are retained in the bundled JSON
assets under `public/fonts/`.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
