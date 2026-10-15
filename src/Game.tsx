import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Background } from './components/Background';
import { Board } from './components/Board';
import { GameOver } from './components/GameOver';
import { GhostLayer } from './components/Ghost';
import { Help } from './components/Help';
import { Hud } from './components/Hud';
import { Tray, type SlotAnim } from './components/Tray';
import {
  anyMove,
  cellIndex,
  newGame,
  placePiece,
  spinPiece,
  TRAY_SIZE,
  type GameState,
  type Terminals,
} from './engine';
import { describePlacement } from './describe';
import { buildFx, circuitDelay, FX_LIFETIME, type FxSpec } from './fx';
import { buzz, type Buzz } from './haptics';
import { loadSounds, play, type Sfx } from './sound';
import { loadSaved, saveGame, saveHaptics, saveHelpSeen, saveSound } from './storage';
import { C, metrics } from './theme';
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
  const [soundOn, setSoundOn] = useState(true);
  const [anims, setAnims] = useState<SlotAnim[]>(() =>
    Array.from({ length: TRAY_SIZE }, () => ({ key: 0, kind: 'deal' as const })),
  );
  const [armed, setArmed] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [wired, setWired] = useState<Terminals | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const stateRef = useRef<GameState | null>(null);
  const mRef = useRef(m);
  const hapticsRef = useRef(true);
  const soundRef = useRef(true);
  const helpSeen = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const startBest = useRef(0);
  useEffect(() => {
    mRef.current = m;
  }, [m]);
  useEffect(() => {
    hapticsRef.current = hapticsOn;
  }, [hapticsOn]);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const haptic = useCallback((kind: Buzz) => buzz(hapticsRef.current, kind), []);
  const sfx = useCallback((kind: Sfx) => play(soundRef.current, kind), []);

  const later = useCallback((run: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      run();
    }, ms);
    timers.current.add(t);
  }, []);

  const cancelTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  useEffect(() => cancelTimers, [cancelTimers]);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    saveGame(next, startBest.current);
  }, []);

  const dealAll = useCallback(() => setAnims((a) => a.map((x) => ({ key: x.key + 1, kind: 'deal' }))), []);

  const startGame = useCallback(
    (best: number) => {
      cancelTimers();
      startBest.current = best;
      commit(newGame(best));
      setOverVisible(false);
      setFx([]);
      setWired(null);
      setChosen(null);
      dealAll();
    },
    [commit, dealAll, cancelTimers],
  );

  useEffect(() => {
    let alive = true;
    loadSaved()
      .then(({ saved, best, haptics, sound, helpSeen: seen }) => {
        if (!alive) return;
        if (!haptics) setHapticsOn(false);
        if (sound) loadSounds();
        else setSoundOn(false);
        if (!seen) {
          helpSeen.current = false;
          setHelpOpen(true);
        }
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
      sfx('over');
    }, 900);
    return () => clearTimeout(t);
  }, [over, haptic, sfx]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2200);
    return () => clearTimeout(t);
  }, [armed]);

  const place = useCallback(
    (i: number, r: number, c: number) => {
      const s = stateRef.current;
      if (!s) return null;
      const p = s.tray[i];
      const res = placePiece(s, i, r, c);
      if (!p || !res) return null;
      commit(res.state);
      setChosen((cur) => (cur === i || res.dealt ? null : cur));
      if (res.dealt) dealAll();
      const covered = new Set(p.cells.map(([dr, dc]) => cellIndex(r + dr, c + dc)));
      const items = buildFx(res, mRef.current);
      setFx((f) => [...f.filter((it) => !('cell' in it && covered.has(it.cell))), ...items]);
      if (items.length) {
        const ids = new Set(items.map((it) => it.id));
        later(() => setFx((f) => f.filter((it) => !ids.has(it.id))), FX_LIFETIME);
      }
      const kind =
        res.surges.length || res.perfect || res.circuit.length ? 'heavy' : res.lineCount ? 'medium' : 'light';
      const sound: Sfx = res.perfect
        ? 'perfect'
        : res.surges.length
          ? 'blast'
          : res.lineCount || res.circuit.length
            ? 'clear'
            : 'place';
      const boom = circuitDelay(res.circuit);
      if (boom) {
        haptic('light');
        sfx('spark');
        setWired(res.wired);
        later(() => {
          haptic(kind);
          sfx(sound);
          setWired((w) => (w === res.wired ? null : w));
        }, boom);
      } else {
        haptic(kind);
        sfx(sound);
      }
      return res;
    },
    [commit, dealAll, haptic, sfx, later],
  );

  const lift = useCallback(() => {
    haptic('select');
    sfx('lift');
  }, [haptic, sfx]);

  const { rootRef, fieldRef, slotRefs, measureLayout, gestures, drag, held, preview, isDragging } = useDragGestures({
    state,
    stateRef,
    m,
    onPlace: place,
    onLift: lift,
  });

  const spin = useCallback(
    (i: number) => {
      const s = stateRef.current;
      if (!s || isDragging()) return;
      const next = spinPiece(s, i);
      if (!next) return;
      commit(next);
      setAnims((a) => a.map((x, k) => (k === i ? { key: x.key + 1, kind: 'spin' } : x)));
      haptic('select');
      sfx('rotate');
    },
    [commit, haptic, sfx, isDragging],
  );

  const selected = chosen !== null && state?.tray[chosen] && !state.over ? chosen : null;

  const choose = useCallback(
    (i: number) => {
      const s = stateRef.current;
      if (!s?.tray[i] || s.over) return;
      const next = selected === i ? null : i;
      setChosen(next);
      AccessibilityInfo.announceForAccessibility(
        next === null ? `Put back U${i + 1}.` : `Chose U${i + 1}. Pick a board square.`,
      );
    },
    [selected],
  );

  const placeAt = useCallback(
    (r: number, c: number) => {
      if (selected === null) return;
      const res = place(selected, r, c);
      setChosen(null);
      if (res) AccessibilityInfo.announceForAccessibility(describePlacement(res));
    },
    [selected, place],
  );

  const toggleHaptics = useCallback(() => {
    const next = !hapticsOn;
    setHapticsOn(next);
    saveHaptics(next);
    buzz(next, 'select');
  }, [hapticsOn]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    saveSound(next);
    play(next, 'rotate');
  }, [soundOn]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    if (helpSeen.current) return;
    helpSeen.current = true;
    saveHelpSeen();
  }, []);

  const restart = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.over || armed) {
      setArmed(false);
      startGame(s.best);
    } else {
      setArmed(true);
      AccessibilityInfo.announceForAccessibility('Tap again to start a new game.');
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
      <View
        aria-hidden={overVisible}
        style={[styles.column, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
      >
        <Hud score={state.score} best={state.best} armed={armed} m={m} onHelp={openHelp} onRestart={restart} />
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
          terminals={wired ?? state.terminals}
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
      </View>
      <GhostLayer tray={state.tray} held={held} m={m} drag={drag} />
      <GameOver
        visible={overVisible}
        score={state.score}
        best={state.best}
        newBest={newBest}
        onAgain={() => startGame(state.best)}
      />
      <Help
        visible={helpOpen}
        onClose={closeHelp}
        hapticsOn={hapticsOn}
        onToggleHaptics={toggleHaptics}
        soundOn={soundOn}
        onToggleSound={toggleSound}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.maskDeep },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 5 },
});
