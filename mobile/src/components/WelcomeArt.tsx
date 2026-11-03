import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

// mountains at dusk (dark) or daytime (light) with a small lit house, fading into the background
export function WelcomeArt({ height = 520 }: { height?: number }) {
  const { c, dark } = useTheme();
  const sky = dark ? ['#111111', '#2B201D', '#6A4434'] : ['#9DB8E6', '#B9CDEF', '#DCE6F6'];
  const far = dark ? '#3D2C27' : '#B4C6E8';
  const mid = dark ? '#2C211E' : '#8FA7D8';
  const peak = dark ? '#241B19' : '#7088C2';
  const hill = dark ? '#191414' : '#5E6C8C';
  const house = dark ? '#0F0C0B' : '#3E4A66';
  const roof = dark ? '#1E1816' : '#4B5878';
  const light = '#F5B041';

  return (
    <Svg width="100%" height={height} viewBox="0 0 390 520" preserveAspectRatio="xMidYMax slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="0.45" stopColor={sky[1]} />
          <Stop offset="0.8" stopColor={sky[2]} />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.background} stopOpacity="0" />
          <Stop offset="1" stopColor={c.background} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="390" height="520" fill="url(#sky)" />
      <Path d="M0 300 L40 262 L78 286 L122 236 L160 268 L204 222 L250 262 L292 228 L336 266 L390 232 L390 520 L0 520 Z" fill={far} />
      <Path d="M0 352 L52 308 L96 336 L150 276 L186 300 L214 262 L246 300 L300 280 L348 318 L390 296 L390 520 L0 520 Z" fill={mid} />
      <Path d="M150 380 L196 300 L210 318 L230 296 L280 380 Z" fill={peak} />
      <Path d="M0 410 C 80 380, 150 372, 210 380 S 330 392, 390 372 L390 520 L0 520 Z" fill={hill} />
      {/* house */}
      <Path d="M228 366 L246 350 L264 366 Z" fill={roof} />
      <Rect x="232" y="366" width="28" height="18" fill={house} />
      <Rect x="237" y="371" width="6" height="6" rx="1" fill={light} />
      <Rect x="249" y="371" width="6" height="6" rx="1" fill={light} />
      <Rect x="0" y="360" width="390" height="160" fill="url(#fade)" />
    </Svg>
  );
}
