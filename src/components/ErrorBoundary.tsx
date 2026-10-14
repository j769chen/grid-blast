import { Component, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clearSavedGame } from '../storage';
import { C, F } from '../theme';

interface State {
  failed: boolean;
  attempt: number;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  reset = () => {
    clearSavedGame().then(() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 })));
  };

  render() {
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.sub}>Your peak score is safe. The current game will be reset.</Text>
        <Pressable onPress={this.reset} accessibilityRole="button" style={styles.btn}>
          <Text style={styles.btnText}>New game</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: C.maskDeep },
  title: { fontFamily: F.bold, fontSize: 22, color: C.silk, textAlign: 'center' },
  sub: { fontFamily: F.medium, fontSize: 15, color: C.silkLabel, textAlign: 'center' },
  btn: { marginTop: 12, paddingVertical: 13, paddingHorizontal: 30, borderRadius: 6, backgroundColor: C.pad },
  btnText: { fontFamily: F.bold, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', color: C.ink },
});
