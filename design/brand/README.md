# hub — Complete Brand Resources v1.0

**Product:** hub  
**URL:** https://hub.anujajay.com  
**Tagline:** ACCESS. TRACK. MANAGE.

## Brand idea
A personal digital space to access, track and manage the information, assets, records and everyday tools that matter.

## Typography system
- **Oxanium** — primary display: major page titles, hero statements and brand moments.
- **Sora** — secondary/UI: navigation, cards, forms, buttons and body copy.
- **JetBrains Mono** — utility: dates, timestamps, IDs, technical labels and metadata.

The CSS in `brand/tokens.css` imports all three fonts from Google Fonts. An internet connection is required for the hosted font files. For self-hosting, download the font families and include their OFL licence files.

## Colour palette
- Primary blue: `#4388F5`
- Deep background: `#11151D`
- Deepest background: `#0D1118`
- Surface: `#1A2230`
- Raised surface: `#222D3D`
- Border: `#303B4B`
- Cool grey: `#929EAF`
- Soft grey: `#B7C0CD`
- Primary text: `#F2F5FA`

Blue is reserved for primary actions, selected states, links and small identity accents. Use charcoal surfaces and cool greys for hierarchy; avoid pure black and neutral mid-grey.

## Logo files
- `logo/svg/monogram-dark.svg` — white mark for dark backgrounds.
- `logo/svg/monogram-light.svg` — ink mark for light backgrounds.
- `logo/svg/monogram-blue.svg` — blue standalone mark.
- `logo/svg/lockup-horizontal-*.svg` — horizontal brand lockups.
- `logo/svg/lockup-stacked-*.svg` — stacked brand lockups.
- PNG exports are in `logo/png/`.

The monogram is vector-traced from the geometric J image supplied in the conversation. It retains the original node-and-line silhouette, cleaned into scalable paths. Inspect the paths at small sizes before final production use.

## App icons
`icons/` contains SVG masters and PNG sizes 16, 32, 48, 64, 128, 180, 192, 256, 512 and 1024 pixels. The favicon is supplied as SVG and 512px PNG.

## Usage rules
- Preserve the monogram proportions and node/line relationships.
- Do not add glow, shadows, gradients or outlines to the core mark.
- Maintain clear space around the mark at least the width of one node.
- Use the blue mark on restrained dark or light surfaces; use white/ink monochrome variants for maximum contrast.
- Use the horizontal lockup for headers and footers; use the standalone mark for app icons and compact navigation.

## Directory
- `logo/` — editable vector and raster logo assets.
- `icons/` — favicons and app icons.
- `brand/` — CSS variables and font setup.
- `docs/` — brand guidelines PDF.
- `previews/` — quick visual references.
