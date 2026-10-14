# Overclock

@AGENTS.md

Single Expo app for iOS, Android and web. See README.md for rules, layout and scripts.

## Before pushing

Run all of these; CI runs the same checks and `main` requires them to pass.

```sh
npm run format:check && npm run typecheck && npm run lint && npm test
```

## Conventions

- Game rules live in `src/engine.ts` as pure functions with no React or platform imports. Add tests in `src/__tests__/` for any rule change.
- Drag feel is tuned by `DRAG_GAIN`, `LIFT_CELLS` and `SNAP_RADIUS` in `src/drag.ts`. Don't change them without testing on a phone.
- Gesture callbacks run as worklets on the UI thread. Read only shared values there, never React refs or state.
- Gesture callbacks report to JS by appending to the `events` shared-value queue in `useDragGestures`, drained in order by one reaction. Calling `scheduleOnRN` with a ref-reading callback from a gesture builder fails the React Compiler lint, and "latest value" shared values drop events that land in the same frame.
- Read shared values directly inside `useAnimatedStyle` and reaction worklets, then pass the values to helpers. Reanimated only watches shared values the worklet itself references, so a helper that calls `.get()` leaves the style stuck.
- A shared value set from the JS thread lands asynchronously. Build the full value and set it once rather than read-modify-write across callbacks.
- Position the dragged piece with `left`/`top` and an explicit size, not transforms; transforms drew it offset on iOS. The return-to-socket animation needs a scale, so it uses its own ghost view and the dragged view stays transform-free.
- Never add `eslint-disable`; fix the underlying issue.

## Workflow

- Branch off `main`, open a PR, and merge with rebase or squash once CI is green. No merge commits.
- Web QA: `npx expo start --web` serves the app at http://localhost:8081 for browser automation.
