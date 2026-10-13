import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { C } from '../theme';

export const Background = memo(function Background() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="0%" rx="120%" ry="90%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={C.mask} />
          <Stop offset="0.7" stopColor={C.maskDeep} />
          <Stop offset="1" stopColor={C.maskDeep} />
        </RadialGradient>
        <Pattern id="traces" width={160} height={160} patternUnits="userSpaceOnUse">
          <G fill="none" stroke={C.copper} strokeOpacity={0.13} strokeWidth={2}>
            <Path d="M0 40h50l20 20h40l20-20h30M40 160v-40l20-20V70M120 0v30l-20 20M160 120h-40l-20 20v20" />
            <Circle cx={40} cy={66} r={4} />
            <Circle cx={100} cy={50} r={4} />
            <Circle cx={100} cy={140} r={4} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glow)" />
      <Rect width="100%" height="100%" fill="url(#traces)" />
    </Svg>
  );
});
