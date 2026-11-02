import { ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { choreEmoji, colors } from '@/lib/theme';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  top = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  top?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[s.screen, { paddingTop: top ? insets.top + 16 : 16, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={s.inner}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Section({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'soft' | 'ghost' | 'coral';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, kind = 'primary', loading, disabled, small, style }: ButtonProps) {
  const bg = { primary: colors.lagoon, soft: colors.lagoonSoft, ghost: 'transparent', coral: colors.coral }[kind];
  const fg = kind === 'primary' || kind === 'coral' ? '#fff' : colors.lagoon;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: colors.line },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#A7ADB2" style={[s.input, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} {...rest} />
    </View>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ label, color = colors.lagoon, bg = colors.lagoonSoft }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Emoji({ icon, size = 44 }: { icon: string; size?: number }) {
  return (
    <View style={[s.emoji, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={{ fontSize: size * 0.5 }}>{choreEmoji[icon] ?? choreEmoji.other}</Text>
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
  return (
    <View style={s.stepper}>
      <Pressable hitSlop={8} onPress={() => onChange(Math.max(min, value - step))} style={s.stepBtn}>
        <Text style={s.stepSign}>−</Text>
      </Pressable>
      <Text style={s.stepValue}>
        {value}
        {suffix}
      </Text>
      <Pressable hitSlop={8} onPress={() => onChange(Math.min(max, value + step))} style={s.stepBtn}>
        <Text style={s.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 18, flexGrow: 1 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.muted, marginTop: 4, lineHeight: 22 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  button: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonSmall: { height: 38, borderRadius: 12, paddingHorizontal: 14 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
  emoji: { backgroundColor: colors.sunSoft, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  stepBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 18, fontWeight: '700', color: colors.lagoon, marginTop: -2 },
  stepValue: { minWidth: 52, textAlign: 'center', fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
