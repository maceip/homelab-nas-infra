# Island refresh: observed browser checks

September 11, 2026. Local production preview only; no Pi deployment changes.

- New overview visibly renders real system values in four colored Animal Island
  cards, with the original map/leaf/footer artwork and local Nunito font.
- Checked the 1365 × 960 desktop layout, the normal narrow app-panel layout,
  and a 390 × 844 phone viewport. Metric cards change from four columns to two;
  the hero, setup rows and private-access cards remain readable without horizontal
  overflow in the inspected states. Temporary viewport override reset afterward.
- Light and dark Island views were visually inspected. The original SPR design
  can be selected in Settings and restored to Island without losing navigation.
- Service filtering for Nostr still reaches its existing details page; Start,
  Stop and Restart remain visibly disabled. No service mutations were performed.
- All real live text and buttons remain DOM elements; the illustration is
  decorative and hidden from assistive technology.
- This browser used the **CSS glass fallback**. Liquid DOM's experimental WebGPU /
  HTML-in-Canvas refraction path is integrated but has **not** been visually
  verified with the required browser feature enabled. Browser flags were not
  changed. Automated tests cover capability detection, reduced motion, failed
  imports, and unmount during initialization.
- Byte comparison confirmed all 884 files in the supplied source archive were
  vendored unchanged. The browser uses a generated 216 KB subset, not the full
  archive. This size is source/assets on disk, not a compressed download claim.

See `results.json` for the latest automated regression/build/SSH run. Browser
observations are separate from those counts.
