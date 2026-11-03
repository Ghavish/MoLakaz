import { Calendar, House, type LucideIcon, Sparkles, Sun } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';

import { font, useTheme } from '@/lib/theme';

const tabs: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: Sun },
  week: { label: 'Week', icon: Calendar },
  assistant: { label: 'Assistant', icon: Sparkles },
  home: { label: 'Home', icon: House },
};

// a floating pill in both modes. the active tab is a capsule with its label, the others are icons only
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        // sit above the phone's own home bar or buttons, not on them
        bottom: 12 + insets.bottom,
        height: 64,
        borderRadius: 32,
        backgroundColor: dark ? c.surface : c.tabBar,
        borderWidth: dark ? 1 : 0,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        shadowColor: dark ? '#000000' : '#0E1E3A',
        shadowOpacity: dark ? 0.5 : 0.12,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
        maxWidth: 528,
        alignSelf: 'center',
      }}
    >
      {state.routes.map((r, i) => {
        const t = tabs[r.name];
        if (!t) return null;
        const on = state.index === i;
        return (
          <Pressable
            key={r.key}
            onPress={() => !on && navigateToTab(r.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={
              on
                ? { height: 48, borderRadius: 24, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18 }
                : { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }
            }
          >
            <t.icon size={20} color={on ? c.onPrimary : c.textMuted} strokeWidth={on ? 2 : 1.8} />
            {on ? <Text style={{ fontFamily: font.semibold, fontSize: 13, color: c.onPrimary }}>{t.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
