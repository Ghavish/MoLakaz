import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleAlert, Image as ImageIcon, Sparkles, X, Zap, ZapOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Txt } from '@/components/ui';
import { api, photoUrl } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { font, space, tell, useTheme } from '@/lib/theme';

const CAMERA_BG = '#1A2236';

export default function Photo() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, step = 'after' } = useLocalSearchParams<{ id: string; step?: 'before' | 'after' }>();
  const { hh, me } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const cam = useRef<CameraView>(null);

  if (!hh || !me) return null;
  const t = hh.tasks.find((x) => x.id === id);
  const chore = t && hh.chores.find((x) => x.id === t.chore);
  if (!t || !chore) return null;

  const after = step === 'after';
  const spot = chore.check.spot || chore.check.look_for[0] || 'mess';
  const before = photoUrl(t.before);
  const hint = after ? `Line up the ${spot} like in your before photo` : `Get the whole ${spot} in the frame`;

  async function upload(uri: string) {
    setBusy(true);
    try {
      if (!after) {
        setHousehold(await api.before(hh!.id, t!.id, me!, uri));
        router.back();
      } else {
        const out = await api.after(hh!.id, t!.id, me!, uri);
        setHousehold(out.household);
        router.replace({ pathname: '/chore/[id]/result', params: { id: t!.id } });
      }
    } catch (e) {
      tell("Couldn't send the photo", (e as Error).message);
      setBusy(false);
    }
  }

  async function shoot() {
    try {
      const pic = await cam.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) upload(pic.uri);
    } catch (e) {
      tell("Couldn't take the photo", (e as Error).message);
    }
  }

  async function gallery() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets?.[0]) upload(res.assets[0].uri);
  }

  const granted = !!perm?.granted;
  const corner = (pos: object, rot: string) => (
    <View style={[{ position: 'absolute', width: 28, height: 28, borderColor: c.amber.strong, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8, transform: [{ rotate: rot }] }, pos]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#000000' : c.background, paddingTop: insets.top + 8 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
        <IconButton icon={X} label="Close" onPress={() => router.back()} bg={dark ? c.surfaceRaised : c.surface} size={40} iconSize={18} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt v="bodyMedium" style={{ fontSize: 14 }}>
            {chore.name}
          </Txt>
          <Txt v="caption" style={{ fontSize: 11 }}>
            Step {after ? 2 : 1} of 2 · {after ? 'After' : 'Before'} photo
          </Txt>
        </View>
        {granted ? (
          <IconButton icon={torch ? Zap : ZapOff} label={torch ? 'Torch off' : 'Torch on'} onPress={() => setTorch((v) => !v)} bg={dark ? c.surfaceRaised : c.surface} size={40} iconSize={16} />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* camera */}
      <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 28, overflow: 'hidden', backgroundColor: CAMERA_BG }}>
        {granted ? (
          <CameraView ref={cam} style={{ flex: 1 }} facing="back" enableTorch={torch} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: '#FFFFFF', textAlign: 'center' }}>Allow the camera so you can photograph the chore.</Text>
            <Button label="Allow camera" onPress={() => requestPerm()} bg="#FFFFFF" fg="#0E1E3A" small />
          </View>
        )}
        {/* before photo ghosted on top, or a dashed outline of the spot */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {after && before ? (
            <Image source={{ uri: before }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.25 }} resizeMode="cover" />
          ) : granted ? (
            <Svg width={200} height={130} viewBox="0 0 200 130">
              <Path d="M10 40 L190 40 L170 125 L30 125 Z" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeDasharray="8 6" fill="none" />
              <Path d="M45 55 L155 55 L142 110 L58 110 Z" stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeDasharray="8 6" fill="none" />
              <Path d="M100 40 L100 22 L118 22 L118 30" stroke="rgba(255,255,255,0.6)" strokeWidth={2} strokeDasharray="5 4" fill="none" />
            </Svg>
          ) : null}
          {corner({ top: 18, left: 18 }, '0deg')}
          {corner({ top: 18, right: 18 }, '90deg')}
          {corner({ bottom: 18, right: 18 }, '180deg')}
          {corner({ bottom: 18, left: 18 }, '270deg')}
          <View style={{ position: 'absolute', top: 22, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 11, color: '#FFFFFF' }}>{after ? 'After photo' : 'Before photo'}</Text>
          </View>
          {dark && (
            <View style={{ position: 'absolute', bottom: 26, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#FFFFFF' }}>{hint}</Text>
            </View>
          )}
        </View>
        {busy && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF', textAlign: 'center' }}>{after ? 'SAM 3.1 is comparing your photos…' : 'Saving your before photo…'}</Text>
            {after && <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>The first check in a while can take up to a minute while the GPU wakes up.</Text>}
          </View>
        )}
      </View>

      {/* bottom controls */}
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 14, paddingBottom: insets.bottom + 18, backgroundColor: dark ? 'transparent' : c.surface, marginTop: dark ? 0 : -24, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        {!dark && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.amber.tint, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14, marginTop: 8 }}>
            <CircleAlert size={14} color={c.amber.ink} strokeWidth={2} />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: c.amber.ink, flex: 1 }}>{hint}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={gallery} accessibilityRole="button" accessibilityLabel="Pick from gallery" style={{ width: 64, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              {after && before ? <Image source={{ uri: before }} style={{ width: 48, height: 48 }} /> : <ImageIcon size={18} color={c.textMuted} strokeWidth={2} />}
            </View>
            <Text style={{ fontFamily: font.regular, fontSize: 10, color: c.textMuted }}>{after && before ? 'Before' : 'Gallery'}</Text>
          </Pressable>
          <Pressable
            onPress={granted ? shoot : gallery}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => ({ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: dark ? '#F2EDE6' : c.text, alignItems: 'center', justifyContent: 'center', opacity: pressed || busy ? 0.7 : 1 })}
          >
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: dark ? '#F2EDE6' : c.text }} />
          </Pressable>
          <View style={{ width: 64, alignItems: 'center', gap: 4 }}>
            <Sparkles size={18} color={c.ai.strong} strokeWidth={2} />
            <Text style={{ fontFamily: font.regular, fontSize: 10, color: c.ai.ink, textAlign: 'center' }}>{after ? 'Checker\nready' : 'Warming\nup checker'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
