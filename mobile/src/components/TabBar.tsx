import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Calendar, House, type LucideIcon, Sparkles, Sun } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, useTheme } from '@/lib/theme';

const tabs: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: Sun },
  week: { label: 'Week', icon: Calendar },
  assistant: { label: 'Assistant', icon: Sparkles },
  home: { label: 'Home', icon: House },
};

// dark: full width bar, icon over label. light: floating white pill with a navy capsule for the active tab
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const go = (_name: string, key: string, focused: boolean) => {
    if (!focused) navigateToTab(key);
  };

  if (dark) {
    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 84 + Math.max(insets.bottom - 12, 0),
          paddingBottom: Math.max(insets.bottom - 12, 0),
          backgroundColor: c.tabBar,
          borderTopWidth: 1,
          borderTopColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {state.routes.map((r, i) => {
          const t = tabs[r.name];
          if (!t) return null;
          const on = state.index === i;
          const color = on ? c.primary : c.textMuted;
          return (
            <Pressable key={r.key} onPress={() => go(r.name, r.key, on)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 64 }}>
              <t.icon size={22} color={color} strokeWidth={on ? 2 : 1.8} />
              <Text style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11, color }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 18 + insets.bottom * 0.5,
        height: 64,
        borderRadius: 32,
        backgroundColor: c.tabBar,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        shadowColor: '#0E1E3A',
        shadowOpacity: 0.12,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
        maxWidth: 528,
        alignSelf: 'center',
        width: undefined,
      }}
    >
      {state.routes.map((r, i) => {
        const t = tabs[r.name];
        if (!t) return null;
        const on = state.index === i;
        return (
          <Pressable
            key={r.key}
            onPress={() => go(r.name, r.key, on)}
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
