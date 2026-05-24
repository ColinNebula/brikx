# Engine Phase 1 Plan

## Goal
Deliver a deterministic-feeling core loop with reproducible piece sequencing, input replay capture, and adaptive visual budgeting for stable frame pacing on mobile and desktop.

## Scope
1. Fixed timestep simulation + decoupled rendering
2. Seedable RNG for gameplay-critical randomness (piece generation)
3. Input replay recorder (seed + timestamped input events)
4. Adaptive frame budgeter (dynamic FX complexity scaling)

## Milestones

### M1: Fixed timestep loop
Status: Implemented (initial)

Tasks:
- Replace variable-step gravity loop with fixed simulation steps at 60 Hz
- Cap catch-up steps per frame to avoid spiral of death
- Keep rendering cadence adaptive (30/60 target based on power mode)

Acceptance criteria:
- Gravity and lock timing feel consistent across frame-rate variance
- No runaway frame catch-up when tab resumes from background

### M2: Seedable gameplay RNG
Status: Implemented (initial)

Tasks:
- Add session seed generation at game reset
- Add deterministic RNG stream for piece bag shuffling
- Store active session seed in runtime state

Acceptance criteria:
- Same seed yields same piece sequence from same input stream
- Piece fairness preserved via 7-bag randomizer

### M3: Replay input recorder
Status: Implemented (initial)

Tasks:
- Start a new replay record on each reset with mode + seed
- Record timestamped input events (move, rotate, hold, hard drop, soft drop, pause)
- Finalize and persist the last replay snapshot to local storage

Acceptance criteria:
- Last run replay object includes seed, mode, event stream, and score summary
- Replay recording stops cleanly on game over or reset

### M4: Adaptive frame budgeter
Status: Implemented (initial)

Tasks:
- Derive budget tier from smoothed frame time
- Expose runtime budget scale (full/balanced/stressed)
- Scale expensive visuals (particles, motif counts, overlays) by budget

Acceptance criteria:
- Visual load decreases under sustained frame stress
- Gameplay remains unaffected while VFX complexity adapts

## Next iteration (Phase 1.1)
1. Replay playback harness
- Deterministic simulation playback using saved seed + input timeline
- Add dev-only replay verifier with checksum for board state every N ticks

2. RNG stream partitioning
- Optional separate deterministic stream for visual effects if exact visual replay is desired
- Keep gameplay stream isolated to avoid desync from cosmetic updates

3. Telemetry and diagnostics
- Surface frame budget tier and sim step debt in debug overlay
- Log dropped catch-up frames and average simulation steps/frame

4. Regression tests
- Add tests for seeded bag reproducibility
- Add tests for replay event ordering and timestamp monotonicity
- Add tests for fixed-step gravity progression across synthetic frame jitter

## Out of scope for Phase 1
- Online multiplayer lockstep
- Full replay UI/controls in production settings screen
- Worker offload for simulation
