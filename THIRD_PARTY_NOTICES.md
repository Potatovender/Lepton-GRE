# Third-Party Software

## MathQuill

Lepton embeds the unmodified JavaScript and CSS distribution from
`@desmos-community/mathquill` **2026.4.21**, licensed under **MPL-2.0**.
The asset hashes match that exact npm release.

- Upstream source: [desmos-community/desmos-community-mathquill](https://github.com/desmos-community/desmos-community-mathquill)
- Original editor project: [desmosinc/mathquill](https://github.com/desmosinc/mathquill)
- Exact distribution: [2026.4.21 package archive](https://registry.npmjs.org/@desmos-community/mathquill/-/mathquill-2026.4.21.tgz)
- Included license: [MPL-2.0](src/libs/mathquill/LICENSE)
- Version, origin, archive integrity, and asset hashes: [vendor manifest](src/libs/mathquill/vendor.json)

Copyright and license headers are retained in the distribution. Lepton's editor
integration and CSS overrides are maintained separately. Lepton is not a Desmos
product and does not imply endorsement by Desmos or the MathQuill contributors.

## Development Tools

These tools are installed through `package-lock.json` and are not shipped in the
public site artifact. Their packages retain their own notices and transitive
dependency licenses.

| Tool | Purpose | License | Source |
| --- | --- | --- | --- |
| TypeScript | Type declarations and test configuration | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| Vite | Local development server | MIT | [vitejs/vite](https://github.com/vitejs/vite) |
| Vitest | Syntax module tests | MIT | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| Playwright | Isolated browser interaction regression tests | Apache-2.0 | [microsoft/playwright](https://github.com/microsoft/playwright) |

Node.js provides the development runtime. WebGL and Canvas are browser APIs, not
bundled third-party libraries. The standalone Lepton renderer has no external
runtime dependencies. See the root README for Lepton's own licensing status.
