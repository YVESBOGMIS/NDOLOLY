import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let sound: Audio.Sound | null = null;
let initializing: Promise<void> | null = null;
let lastPlayAt = 0;

async function ensureLoaded() {
  if (Platform.OS === 'web') return;
  if (sound) return;
  if (initializing) return initializing;

  initializing = (async () => {
    // On iOS, allow the sound even if the device is in silent mode.
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      } as any);
    } catch {
      // Ignore audio mode errors.
    }

    const asset = require('../assets/sounds/message.wav');
    const created = await Audio.Sound.createAsync(asset, { shouldPlay: false });
    sound = created.sound;
  })().finally(() => {
    initializing = null;
  });

  return initializing;
}

export async function playIncomingMessageSound() {
  if (Platform.OS === 'web') return;

  // Basic throttle so bursts of events don't spam the speaker.
  const now = Date.now();
  if (now - lastPlayAt < 700) return;
  lastPlayAt = now;

  try {
    await ensureLoaded();
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // Ignore sound playback errors.
  }
}

