# teXlab diagram style benchmark

This is the visual standard for every figure teXlab ships or generates.
Gallery templates and library `.tex` files must match this bar. Models should
adapt these conventions — not invent a new look each time.

## Palette (canonical) — teXlab house colors

Steel / sage / copper / plum — color-blind friendly and **distinct from** common
Okabe–Ito clones. Always define in the preamble; never stock `blue`/`red` or random hex.

| Name | Hex | Role |
|------|-----|------|
| `tlblue` | `#2E6B8A` | Primary cards, neurons, start/end terminals |
| `tlteal` | `#3D8B7A` | Decisions, data/storage accents |
| `tlorange` | `#B86B2C` | Highlights, retry loops, warnings |
| `tlpurple` | `#6E5A7E` | Tertiary / rare accents |
| `tlgray` | `#3F4A56` | Edges, labels, dashed externals |

Fills: light tints (`tlblue!12`–`!18`). Strokes: darkened (`tlblue!80!black`).

```latex
\definecolor{tlblue}{HTML}{2E6B8A}
\definecolor{tlteal}{HTML}{3D8B7A}
\definecolor{tlorange}{HTML}{B86B2C}
\definecolor{tlpurple}{HTML}{6E5A7E}
\definecolor{tlgray}{HTML}{3F4A56}
```

## Layout craft

1. **Standalone** — `\documentclass[border=8pt]{standalone}` unless the user asks for a snippet.
2. **Parametric** — counts, spacing, and labels live in a `\def` block at the top so edits are cheap.
3. **Named nodes** — semantic ids (`L1-1`, `db`, `enc`). Edges connect names only.
4. **Relative spacing** — prefer `positioning` / computed grids over scattered absolute coords.
5. **Depth** — dense edges go on a background layer so nodes sit cleanly on top.
6. **Typography** — `\sffamily\small` (or `\footnotesize`) for labels; never flush to borders (≥0.25cm padding).
7. **Scope** — draw only what the prompt asks for; no invented Client/Gateway stacks.
8. **Output** — LaTeX only. No English commentary, `\caption`, or `figure` floats in standalone.

## Shape grammar (diagrams)

| Concept | Default look |
|---------|----------------|
| Neuron / unit | Circle, `tlblue!14` fill, `tlblue!80!black` stroke |
| Process / service | Rounded card, `tlblue!10` fill, `tlblue!75!black` stroke |
| Terminal (start/end) | Rounded pill, `tlblue!14` fill |
| Decision | Diamond, `tlteal` family |
| Database | Cylinder, `tlteal` family |
| Cache / highlight store | Cylinder, `tlorange` family |
| External / client | Dashed `tlgray` card |
| Encoder trapezoid | `tlblue` fill, narrows toward latent |
| Decoder trapezoid | `tlteal` fill, widens from latent |
| Latent bottleneck $z$ | Copper `tlorange` card (the accent) |
| I/O bars | `tlblue` family (not flat gray) |
| ResNet weight layer | `tlblue` card on the residual stem |
| ResNet sum node | Teal circled $+$ |
| Identity skip | Copper `tlorange` bowed path |
| Training data stage | `tlteal` card |
| Training model stage | `tlblue` card |
| Loss stage | `tlpurple` card |
| Optimizer / θ update | `tlorange` card + feedback path |
| Main edges | `tlgray!65`, Stealth tips |
| Retry / highlight edges | `tlorange` |

## Pass / fail checklist

A figure meets the benchmark when:

- [ ] Compiles standalone first try
- [ ] Uses only `tl*` palette names (or monochrome when requested)
- [ ] Labels readable, aligned, not overlapping nodes/edges
- [ ] Uniform sizes within a group; even whitespace
- [ ] Matches prompt scope (no extra tiers)
- [ ] Edges never paint over node fills (use layers when dense)

Reference implementations: `library/templates/feedforward-nn/`, `library/templates/flowchart-decision/`.
