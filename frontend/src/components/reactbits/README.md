# React Bits components in Masroof

CountUp, SpotlightCard, and AnimatedContent were downloaded from the official JavaScript + Tailwind registry definitions:

- https://reactbits.dev/r/CountUp-JS-TW.json
- https://reactbits.dev/r/SpotlightCard-JS-TW.json
- https://reactbits.dev/r/AnimatedContent-JS-TW.json

The requested `https://reactbits.dev/r/Squares-JS-TW.json` returns HTTP 404. Squares was instead downloaded from the [official repository at revision 1ea69ea](https://github.com/DavidHDev/react-bits/blob/1ea69ea03bef6e6fa5895cc68f60636c286a5f55/src/tailwind/Backgrounds/Squares/Squares.jsx), before its removal from the current source tree.

The adjacent [LICENSE.md](./LICENSE.md) contains React Bits’ upstream license and copyright notice. These components are included as part of the Masroof application. Motion and GSAP are installed dependencies of the official CountUp and AnimatedContent implementations.

Local adaptations preserve the requested APIs and add:

- Shared reduced-motion detection that responds to preference changes.
- Safe static rendering when observers, animation frames, or canvas rendering are unavailable, including JSDOM.
- Stable counter width, fixed decimal precision, accessible final values, and finite-number normalization.
- Caller-controlled light card surfaces, a semantic button option for demo cards, and the exact requested emerald spotlight settings.
- A light login grid, pointer-transparent canvases, and grid animation cleanup when the page is hidden or unmounted.

The integrations keep Arabic strings intact. No character animations are applied to names, descriptions, or notes. The grid is only imported by LoginPage.
