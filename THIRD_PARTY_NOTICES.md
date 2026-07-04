# Third-Party Notices

This project includes third-party software and assets. Record each dependency and asset used in release builds.

## How To Use This File

- Add one row per third-party dependency or asset included in a distributed build.
- Include both runtime and build-time dependencies if they are redistributed.
- For each entry, verify license obligations (attribution, notice files, source disclosure, etc.).
- Update this file before each public release and Steam build.

## Components

| Name | Version | Type | License | Source | Notes |
|---|---|---|---|---|---|
| React | 19.2.3 | npm package | MIT | https://github.com/facebook/react | |
| React DOM | 19.2.3 | npm package | MIT | https://github.com/facebook/react | |
| react-scripts | 5.0.1 | npm package | MIT | https://github.com/facebook/create-react-app | |
| web-vitals | 2.1.4 | npm package | Apache-2.0 | https://github.com/GoogleChrome/web-vitals | Confirm notice requirements |

## Audio Assets

| File | Source | License | Attribution Required | Notes |
|---|---|---|---|---|
| mixkit-*.wav / mixkit-*.mp3 | Mixkit | Verify per-asset terms | Check asset page | Confirm Steam distribution terms |
| Cycles_of_Existence.mp3 | TBD | TBD | TBD | Fill in before release |
| Dancing_with_a_Photon.mp3 | TBD | TBD | TBD | Fill in before release |
| EBS.mp3 | TBD | TBD | TBD | Fill in before release |
| Nineteen_Eighty_Seven.mp3 | TBD | TBD | TBD | Fill in before release |
| Sneaky_Charlie.mp3 | TBD | TBD | TBD | Fill in before release |
| Urban_Street_Speak.mp3 | TBD | TBD | TBD | Fill in before release |

## Fonts And Visual Assets

| Asset | Source | License | Attribution Required | Notes |
|---|---|---|---|---|
| Google Fonts (Orbitron, Rajdhani, Inter, Exo 2, Press Start 2P) | Google Fonts | OFL / per-family license | Usually no, verify | Include exact license per family |
| Brikx-Title.png and icons | Project-owned | Proprietary / project-owned | No | Confirm ownership chain |

## Distribution Checklist

- LICENSE file included in release package
- THIRD_PARTY_NOTICES.md included in release package
- Required attributions shown in-game or in documentation
- Steam store/legal copy updated if attribution is required
- Source links verified and reachable
