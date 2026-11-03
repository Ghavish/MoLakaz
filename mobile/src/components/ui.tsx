import { router } from 'expo-router';
import {
  ArrowRight,
  Bed,
  Brush,
  ChevronLeft,
  CookingPot,
  Leaf,
  type LucideIcon,
  Shirt,
  ShowerHead,
  Sofa,
  Sparkle,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from 'lucide-react-native';
import { ReactNode, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, makeStyles, radius, space, type Tone, type ToneName, useTheme } from '@/lib/theme';

// ---------- layout ----------

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  tab = false,
  footer,
  scroll = true,
  style,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  tab?: boolean; // leaves room for the tab bar
  footer?: ReactNode; // pinned to the bottom, e.g. the main button
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const bottom = tab ? 100 + insets.bottom : footer ? 16 : insets.bottom + 32;
  const pad = { paddingTop: insets.top + 20, paddingBottom: bottom };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[layout.screen, pad, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} /> : undefined}
        >
          <View style={layout.inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[layout.screen, pad, { flex: 1 }, style]}>
          <View style={[layout.inner, { flex: 1 }]}>{children}</View>
        </View>
      )}
      {footer ? (
        <View style={[layout.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={layout.inner}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const layout = StyleSheet.create({
  screen: { paddingHorizontal: space.screenX, flexGrow: 1 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  footer: { paddingHorizontal: space.screenX, paddingTop: 8 },
});

export function Row({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// horizontal chip rows, no scrollbar
export function HScroll({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -space.screenX, flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: space.screenX, gap: 8 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ---------- text ----------

type Variant = 'display' | 'score' | 'title' | 'titleTab' | 'section' | 'body' | 'bodyMedium' | 'caption' | 'label' | 'script';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.medium, fontSize: 30, lineHeight: 38 },
  score: { fontFamily: font.semibold, fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  title: { fontFamily: font.semibold, fontSize: 26, lineHeight: 34 },
  titleTab: { fontFamily: font.semibold, fontSize: 22, lineHeight: 30 },
  section: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 18 },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 15 },
  script: { fontFamily: font.script, fontSize: 34, lineHeight: 44 },
};

export function Txt({
  children,
  v = 'body',
  color,
  muted,
  center,
  style,
  numberOfLines,
  strike,
}: {
  children: ReactNode;
  v?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  strike?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  const base = v === 'caption' || muted ? c.textMuted : c.text;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        variants[v],
        { color: color ?? base },
        center && { textAlign: 'center' },
        strike && { textDecorationLine: 'line-through' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function TextLink({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Txt v="caption" color={color ?? c.primary} style={{ fontFamily: font.semibold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Section({ children, right, first }: { children: ReactNode; right?: ReactNode; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: first ? 0 : space.section, marginBottom: 6, minHeight: 44 }}>
      <Txt v="section">{children}</Txt>
      {right}
    </View>
  );
}

// ---------- buttons ----------

type ButtonKind = 'primary' | 'outline' | 'highlight' | 'tint';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon: Icon,
  arrow,
  loading,
  disabled,
  small,
  bg,
  fg,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: LucideIcon;
  arrow?: boolean;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  bg?: string;
  fg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const colours = {
    primary: [c.primary, c.onPrimary],
    highlight: [c.highlight, c.onHighlight],
    outline: ['transparent', c.text],
    tint: [c.surfaceRaised, c.text],
  }[kind];
  const back = bg ?? colours[0];
  const front = fg ?? colours[1];
  const h = small ? 44 : 56;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: h / 2,
          backgroundColor: back,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: small ? 16 : 22,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        kind === 'outline' && { borderWidth: 1, borderColor: c.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={front} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={front} strokeWidth={2} /> : null}
          <Text style={{ fontFamily: kind === 'outline' ? font.medium : font.semibold, fontSize: small || kind === 'outline' ? 13.5 : 15, color: front }}>{label}</Text>
          {arrow ? <ArrowRight size={18} color={front} strokeWidth={2} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = 44,
  bg,
  color,
  iconSize = 20,
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  size?: number;
  bg?: string;
  color?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? c.surfaceRaised, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Icon size={iconSize} color={color ?? c.text} strokeWidth={2} />
    </Pressable>
  );
}

export function Header({ right, close, title, onBack }: { right?: ReactNode; close?: boolean; title?: string; onBack?: () => void }) {
  const { c } = useTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 44 }}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={close ? 'Close' : 'Back'} hitSlop={8} style={{ width: 44, height: 44, justifyContent: 'center', marginLeft: -10, alignItems: 'center' }}>
        {close ? <X size={22} color={c.text} strokeWidth={2} /> : <ChevronLeft size={24} color={c.text} strokeWidth={2} />}
      </Pressable>
      {title ? (
        <Txt v="bodyMedium" style={{ position: 'absolute', left: 44, right: 44, textAlign: 'center' }} numberOfLines={1}>
          {title}
        </Txt>
      ) : null}
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// ---------- surfaces ----------

export function Card({ children, style, onPress, onLongPress, small }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  small?: boolean;
}) {
  const { c, shadow } = useTheme();
  const box: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: small ? radius.cardSmall : radius.card, padding: 16 }, shadow, style];
  if (!onPress && !onLongPress) return <View style={box}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function TintCard({ tone, children, style }: { tone: ToneName; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c[tone].tint, borderRadius: radius.cardSmall, padding: 16 }, style]}>{children}</View>;
}

// a card holding rows split by thin lines
export function ListCard({ children, style }: { children: ReactNode[]; style?: StyleProp<ViewStyle> }) {
  const { c, shadow } = useTheme();
  const items = children.filter(Boolean);
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.card, paddingHorizontal: 16 }, shadow, style]}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

// ---------- small bits ----------

export function Chip({
  label,
  selected,
  onPress,
  tone,
  icon: Icon,
  selectedKind = 'primary',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: ToneName;
  icon?: LucideIcon;
  selectedKind?: 'primary' | 'highlight';
}) {
  const { c, shadow } = useTheme();
  let bg = c.surface;
  let fg = c.textSecondary;
  if (tone) {
    bg = c[tone].tint;
    fg = c[tone].ink;
  }
  if (selected) {
    bg = selectedKind === 'primary' ? c.primary : c.highlight;
    fg = selectedKind === 'primary' ? c.onPrimary : c.onHighlight;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        { height: 38, borderRadius: 19, paddingHorizontal: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 },
        !tone && !selected && shadow,
      ]}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={2} /> : null}
      <Text style={{ fontFamily: selected ? font.semibold : font.medium, fontSize: 12.5, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function PersonTile({ name, tone, size = 40, filled, round, ring }: { name: string; tone: Tone; size?: number; filled?: boolean; round?: boolean; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : size >= 40 ? radius.tile : radius.avatarTile,
        backgroundColor: filled ? tone.strong : tone.tint,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: tone.strong,
      }}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: Math.min(Math.max(size * 0.36, 13), 28), color: filled ? '#FFFFFF' : tone.ink }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export function Badge({ label, tone, bg, fg }: { label: string; tone?: ToneName; bg?: string; fg?: string }) {
  const { c } = useTheme();
  const t = c[tone ?? 'amber'];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: bg ?? t.tint, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: fg ?? t.ink }}>{label}</Text>
    </View>
  );
}

export function ProgressRing({ done, total, size = 50 }: { done: number; total: number; size?: number }) {
  const { c } = useTheme();
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${done} of ${total} done`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceRaised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.success.strong}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: c.text }}>
        {done}/{total}
      </Text>
    </View>
  );
}

export function FairnessBars({ rows }: { rows: { key: string; name: string; tone: Tone; pct: number; scale: number }[] }) {
  const { c, dark } = useTheme();
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 48, fontFamily: font.semibold, fontSize: 12, color: r.tone.ink }} numberOfLines={1}>
            {r.name}
          </Text>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: dark ? c.surfaceRaised : 'rgba(255,255,255,0.75)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (r.pct / r.scale) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: r.tone.strong }} />
          </View>
          <Text style={{ width: 34, textAlign: 'right', fontFamily: font.regular, fontSize: 12, color: c.textMuted }}>{Math.round(r.pct * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

// purple bars, brighter toward the middle; animated unless reduced motion is on
export function Waveform({ bars = 34, height = 48, animated = true, played, color, barWidth = 4, gap = 4 }: {
  bars?: number;
  height?: number;
  animated?: boolean;
  played?: number; // 0..1, colours the played part for playback rows
  color?: string;
  barWidth?: number;
  gap?: number;
}) {
  const { c } = useTheme();
  const tint = color ?? c.ai.strong;
  const vals = useRef([...Array(bars)].map(() => new Animated.Value(1))).current;
  const shape = useRef([...Array(bars)].map((_, i) => {
    const mid = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
    return 0.25 + 0.75 * mid * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7)));
  })).current;

  useEffect(() => {
    if (!animated) return;
    let cancelled = false;
    const loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (reduced || cancelled) return;
        vals.forEach((v, i) => {
          const loop = Animated.loop(
            Animated.sequence([
              Animated.delay((i % 8) * 70),
              Animated.timing(v, { toValue: 0.55, duration: 550, useNativeDriver: Platform.OS !== 'web' }),
              Animated.timing(v, { toValue: 1, duration: 550, useNativeDriver: Platform.OS !== 'web' }),
            ]),
          );
          loops.push(loop);
          loop.start();
        });
      });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [animated]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap, height }}>
      {shape.map((h, i) => {
        const mid = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const isPlayed = played === undefined ? true : i / bars < played;
        return (
          <Animated.View
            key={i}
            style={{
              width: barWidth,
              height: Math.max(4, h * height),
              borderRadius: barWidth / 2,
              backgroundColor: isPlayed ? tint : c.textFaint,
              opacity: played === undefined ? 0.35 + 0.65 * mid : isPlayed ? 1 : 0.45,
              transform: [{ scaleY: vals[i] }],
            }}
          />
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceRaised, borderRadius: 24, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? c.highlight : 'transparent' }}
          >
            {Icon ? <Icon size={15} color={on ? c.onHighlight : c.textMuted} strokeWidth={2} /> : null}
            <Text style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 13, color: on ? c.onHighlight : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, suffix = '' }: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const { c } = useTheme();
  const btn = { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center' as const, justifyContent: 'center' as const };
  const sign = { fontFamily: font.medium, fontSize: 18, color: c.text, marginTop: -1 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceRaised, borderRadius: 22, padding: 4, alignSelf: 'flex-start' }}>
      <Pressable hitSlop={6} accessibilityLabel="Less" onPress={() => onChange(Math.max(min, value - step))} style={btn}>
        <Text style={sign}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 56, textAlign: 'center', fontFamily: font.semibold, fontSize: 14, color: c.text }}>
        {value}
        {suffix}
      </Text>
      <Pressable hitSlop={6} accessibilityLabel="More" onPress={() => onChange(Math.min(max, value + step))} style={btn}>
        <Text style={sign}>+</Text>
      </Pressable>
    </View>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Txt v="caption" style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={c.textFaint}
        style={[
          {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.tile,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: font.regular,
            fontSize: 15,
            color: c.text,
          },
          rest.multiline && { minHeight: 96, textAlignVertical: 'top', lineHeight: 23 },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

// bottom sheet for edit forms and settings
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', paddingBottom: insets.bottom + 16 }}>
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flexShrink: 1 }}>
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screenX, paddingTop: 8 }}>
              <Txt v="section">{title}</Txt>
              <IconButton icon={X} label="Close" onPress={onClose} size={36} iconSize={18} />
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: space.screenX, paddingTop: 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: space.screenX, paddingTop: 8 }}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- chores ----------

const choreIcons: Record<string, [LucideIcon, ToneName]> = {
  dishes: [Utensils, 'blue'],
  table: [Sparkle, 'amber'],
  sweep: [Brush, 'amber'],
  trash: [Trash2, 'success'],
  tidy: [Sofa, 'ai'],
  laundry: [Shirt, 'ai'],
  bathroom: [ShowerHead, 'blue'],
  cook: [CookingPot, 'coral'],
  yard: [Leaf, 'success'],
  bed: [Bed, 'coral'],
  other: [Sparkles, 'ai'],
};

export function choreTone(icon: string): ToneName {
  return (choreIcons[icon] ?? choreIcons.other)[1];
}

export function ChoreIcon({ icon, size = 40, muted }: { icon: string; size?: number; muted?: boolean }) {
  const { c } = useTheme();
  const [Icon, tone] = choreIcons[icon] ?? choreIcons.other;
  const t = c[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: radius.avatarTile, backgroundColor: muted ? c.surfaceRaised : t.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.45} color={muted ? c.textMuted : t.ink} strokeWidth={2} />
    </View>
  );
}

export function Spinner() {
  const { c } = useTheme();
  return <ActivityIndicator color={c.textMuted} />;
}
