import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

const stroke = { fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function RotateIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" stroke={color} {...stroke} />
    </Svg>
  );
}

export function RestartIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" stroke={color} {...stroke} />
    </Svg>
  );
}

export function VibrateIcon({ size = 19, color, off = false }: IconProps & { off?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8} y={3} width={8} height={18} rx={2} stroke={color} {...stroke} strokeWidth={2.2} />
      {off ? <Path d="M3 3l18 18" stroke={color} {...stroke} /> : <Path d="M4 8v8M20 8v8" stroke={color} {...stroke} />}
    </Svg>
  );
}

export function SoundIcon({ size = 19, color, off = false }: IconProps & { off?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 9h4l5-4v14l-5-4H3z" stroke={color} {...stroke} strokeWidth={2.2} />
      {off ? (
        <Path d="M16 9l5 6M21 9l-5 6" stroke={color} {...stroke} />
      ) : (
        <Path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" stroke={color} {...stroke} />
      )}
    </Svg>
  );
}

export function CalendarIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2} stroke={color} {...stroke} strokeWidth={2.2} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} {...stroke} strokeWidth={2.2} />
    </Svg>
  );
}
