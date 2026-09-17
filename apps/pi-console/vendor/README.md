# Vendored design library

`animal-island-ui/` is the complete, unmodified contents of the user-supplied
`animal-island-ui-891455a-pre-rewrite.zip`, with only the archive's top-level
directory prefix removed. The source is version 1.8.0 at commit
`891455ac8bd1194b1adc5e3a768bc3dd7ad713c5`; archive SHA-256 and provenance are in
`animal-island-ui-provenance.json`.

Upstream author: guokaigdg. Source: https://github.com/guokaigdg/animal-island-ui
License: **CC BY-NC 4.0**, retained verbatim in `animal-island-ui/LICENSE`.
This vendored material has its own license; it is not relicensed under SPR's
license or Liquid DOM's MIT license. This integration is for the personal Pi
dashboard. Archive documentation and automation files are reference material;
no archive hook, CI workflow, deployment command or lifecycle script was run.

The dashboard consumes Card, Button, Tag and Progress, together with design
tokens, selected original artwork and locally served Nunito fonts. Run
`corepack yarn vendor:island` from `../frontend` to regenerate the small runtime
subset under `frontend/src/vendor/animal-island`. That build transpiles TSX,
compiles Less to CSS Modules, copies selected assets, and emits source hashes.
It does not mutate the source copy or install a newer Animal Island release.

Liquid DOM is installed separately as the exact npm dependency
`@liquid-dom/core@0.1.1`, from AndrewPrifer/liquid-dom, MIT. Its layout dependency
is pinned by Yarn. The dashboard uses the core adapter API so it can keep SPR's
React 18 rather than introducing React 19 for the React bindings.
