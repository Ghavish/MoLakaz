import { MrsSaintDelafield_400Regular } from '@expo-google-fonts/mrs-saint-delafield';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

export default function RootLayout() {
  const { c, dark } = useTheme();
  const [loaded, error] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, MrsSaintDelafield_400Regular });

  // hold on the background colour until the fonts are in, so nothing jumps
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="voice/index" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="voice/confirm" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="chore/[id]/photo" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </View>
  );
}
