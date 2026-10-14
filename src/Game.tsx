import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Background } from './components/Background';
import { Board } from './components/Board';
import { GameOver } from './components/GameOver';
import { GhostLayer } from './components/Ghost';
import { Hud } from './components/Hud';
import { Tray, type SlotAnim } from './components/Tray';
import { anyMove, newGame, placePiece, spinPiece, TRAY_SIZE, type GameState } from './engine';
import { fmt } from './format';
import { buildFx, FX_LIFETIME, type FxSpec } from './fx';
import { buzz, type Buzz } from './haptics';
import { loadSaved, saveGame, saveHaptics } from './storage';
import { C, F, metrics } from './theme';
import { useDragGestures } from './useDragGestures';

export default function Game() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const m = useMemo(
    () => metrics(width, height - insets.top - insets.bottom),
    [width, height, insets.top, insets.bottom],
  );

  const [state, setState] = useState<GameState | null>(null);
  const [fx, setFx] = useState<FxSpec[]>([]);
  const [overVisible, setOverVisible] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [anims, setAnims] = useState<SlotAnim[]>(() =>
    Array.from({ length: TRAY_SIZE }, () => ({ key: 0, kind: 'deal' as const })),
  );
  const [armed, setArmed] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  const stateRef = useRef<GameState | null>(null);
  const mRef = useRef(m);
  const hapticsRef = useRef(true);
  const startBest = useRef(0);
  useEffect(() => {
    mRef.current = m;
  }, [m]);
  useEffect(() => {
    hapticsRef.current = hapticsOn;
  }, [hapticsOn]);

  const haptic = useCallback((kind: Buzz) => buzz(hapticsRef.current, kind), []);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    saveGame(next, startBest.current);
  }, []);

  const dealAll = useCallback(() => setAnims((a) => a.map((x) => ({ key: x.key + 1, kind: 'deal' }))), []);

  const startGame = useCallback(
    (best: number) => {
      startBest.current = best;
      commit(newGame(best));
      setOverVisible(false);
      setFx([]);
      dealAll();
    },
    [commit, dealAll],
  );

  useEffect(() => {
    let alive = true;
    loadSaved()
      .then(({ saved, best, haptics }) => {
        if (!alive) return;
        if (!haptics) setHapticsOn(false);
        if (saved && !saved.game.over) {
          const game = { ...saved.game, best: Math.max(saved.game.best, best) };
          startBest.current = saved.startBest;
          commit({ ...game, over: !anyMove(game) });
        } else {
          startGame(best);
        }
      })
      .catch(() => {
        if (alive) startGame(0);
      });
    return () => {
      alive = false;
    };
  }, [commit, startGame]);

  const over = state?.over ?? false;
  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => {
      const s = stateRef.current;
      setNewBest(!!s && s.score > 0 && s.score > startBest.current);
      setOverVisible(true);
      haptic('error');
    }, 900);
    return () => clearTimeout(t);
  }, [over, haptic]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2200);
    return () => clearTimeout(t);
  }, [armed]);

  const place = useCallback(
    (i: number, r: number, c: number) => {
      const s = stateRef.current;
      if (!s) return null;
      const res = placePiece(s, i, r, c);
      if (!res) return null;
      commit(res.state);
      if (res.dealt) dealAll();
      const items = buildFx(res, mRef.current);
      if (items.length) {
        const ids = new Set(items.map((it) => it.id));
        setFx((f) => [...f, ...items]);
        setTimeout(() => setFx((f) => f.filter((it) => !ids.has(it.id))), FX_LIFETIME);
      }
      haptic(res.surges.length || res.perfect || res.circuit.length ? 'heavy' : res.lineCount ? 'medium' : 'light');
      return res;
    },
    [commit, dealAll, haptic],
  );

  const { rootRef, fieldRef, slotRefs, measureLayout, gestures, drag, held, preview, isDragging } = useDragGestures({
    state,
    stateRef,
    m,
    onPlace: place,
    haptic,
  });

  const spin = useCallback(
    (i: number) => {
      const s = stateRef.current;
      if (!s || s.over || !s.tray[i] || isDragging()) return;
      const next = spinPiece(s, i);
      if (!next) return;
      commit(next);
      setAnims((a) => a.map((x, k) => (k === i ? { key: x.key + 1, kind: 'spin' } : x)));
      haptic('select');
    },
    [commit, haptic, isDragging],
  );

  const selected = chosen !== null && state?.tray[chosen] && !state.over ? chosen : null;

  const choose = useCallback((i: number) => {
    setChosen((cur) => (cur === i ? null : i));
    const p = stateRef.current?.tray[i];
    if (p) AccessibilityInfo.announceForAccessibility(`Chose U${i + 1}. Pick a board square.`);
  }, []);

  const placeAt = useCallback(
    (r: number, c: number) => {
      if (selected === null) return;
      const res = place(selected, r, c);
      setChosen(null);
      if (!res) return;
      const cleared = res.lineCount ? `${res.lineCount} ${res.lineCount > 1 ? 'lines' : 'line'} cleared. ` : '';
      const circuit = res.circuit.length ? 'Circuit complete. ' : '';
      const over = res.state.over ? ' No part fits. Game over.' : '';
      AccessibilityInfo.announceForAccessibility(`Placed. ${circuit}${cleared}Score ${fmt(res.state.score)}.${over}`);
    },
    [selected, place],
  );

  const toggleHaptics = useCallback(() => {
    const next = !hapticsOn;
    setHapticsOn(next);
    saveHaptics(next);
    buzz(next, 'select');
  }, [hapticsOn]);

  const restart = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.over || armed) {
      setArmed(false);
      startGame(s.best);
    } else {
      setArmed(true);
    }
  }, [armed, startGame]);

  if (!state) {
    return (
      <View style={styles.root}>
        <Background />
      </View>
    );
  }

  return (
    <View ref={rootRef} onLayout={measureLayout} style={styles.root}>
      <Background />
      <View style={[styles.column, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Hud
          score={state.score}
          best={state.best}
          hapticsOn={hapticsOn}
          armed={armed}
          m={m}
          onToggleHaptics={toggleHaptics}
          onRestart={restart}
        />
        <Board
          grid={state.grid}
          cores={state.cores}
          preview={preview}
          m={m}
          fieldRef={fieldRef}
          onBoardLayout={measureLayout}
          fx={fx}
          tray={state.tray}
          drag={drag}
          placing={selected === null ? null : state.tray[selected]}
          onPlaceAt={placeAt}
          terminals={state.terminals}
        />
        <Tray
          tray={state.tray}
          grid={state.grid}
          m={m}
          anims={anims}
          gestures={gestures}
          slotRefs={slotRefs}
          onTrayLayout={measureLayout}
          drag={drag}
          onRotate={spin}
          selected={selected}
          onSelect={choose}
        />
        <Text style={[styles.note, { width: m.size }]}>
          Rotate parts as often as you like. Square cores blast their row and column; round cores blast the 3×3 around
          them.
        </Text>
      </View>
      <GhostLayer tray={state.tray} held={held} m={m} drag={drag} />
      <GameOver
        visible={overVisible}
        score={state.score}
        best={state.best}
        newBest={newBest}
        onAgain={() => startGame(state.best)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.maskDeep },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  note: {
    fontFamily: F.mono,
    fontSize: 10.5,
    lineHeight: 16,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: C.silkDim,
  },
});
