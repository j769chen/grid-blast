import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Background } from './components/Background';
import { Board } from './components/Board';
import { FX_LIFETIME, type FxSpec } from './components/Fx';
import { GameOver } from './components/GameOver';
import { GhostLayer } from './components/Ghost';
import { Hud } from './components/Hud';
import { Tray, type SlotAnim } from './components/Tray';
import { anyMove, newGame, placePiece, spinPiece, TRAY_SIZE, type GameState } from './engine';
import { buildFx } from './fx';
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
  const [shakeKey, setShakeKey] = useState(0);

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
      if (!s) return;
      const res = placePiece(s, i, r, c);
      if (!res) return;
      commit(res.state);
      if (res.dealt) dealAll();
      const items = buildFx(res, mRef.current);
      if (items.length) {
        const ids = new Set(items.map((it) => it.id));
        setFx((f) => [...f, ...items]);
        setTimeout(() => setFx((f) => f.filter((it) => !ids.has(it.id))), FX_LIFETIME);
      }
      haptic(!res.lineCount ? 'light' : res.surges.length || res.perfect ? 'heavy' : 'medium');
    },
    [commit, dealAll, haptic],
  );

  const { rootRef, fieldRef, slotRefs, measureLayout, gestures, drag, dragSlot, landing, preview, isDragging } =
    useDragGestures({ state, stateRef, m, onPlace: place, haptic });

  const spin = useCallback(
    (i: number) => {
      const s = stateRef.current;
      if (!s || s.over || !s.tray[i] || isDragging()) return;
      const next = spinPiece(s, i);
      if (!next) {
        setShakeKey((k) => k + 1);
        haptic('warning');
        return;
      }
      commit(next);
      setAnims((a) => a.map((x, k) => (k === i ? { key: x.key + 1, kind: 'spin' } : x)));
      haptic('select');
    },
    [commit, haptic, isDragging],
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
          charge={state.charge}
          hapticsOn={hapticsOn}
          armed={armed}
          shakeKey={shakeKey}
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
        />
        <Tray
          tray={state.tray}
          grid={state.grid}
          charge={state.charge}
          m={m}
          anims={anims}
          gestures={gestures}
          slotRefs={slotRefs}
          onTrayLayout={measureLayout}
          dragSlot={dragSlot}
          landing={landing}
          onRotate={spin}
        />
        <Text style={[styles.note, { width: m.size }]}>
          Each rotation costs 1 charge. Clearing lines recharges. Cores blast their whole row and column.
        </Text>
      </View>
      <GhostLayer tray={state.tray} m={m} drag={drag} />
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
