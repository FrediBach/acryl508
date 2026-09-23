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

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
