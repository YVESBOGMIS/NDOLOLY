import Constants from 'expo-constants';

function guessDevHost() {
  // In Expo Go dev, we can infer the LAN host from the packager host.
  const hostUri =
    // SDK 49+
    Constants.expoConfig?.hostUri ||
    // Fallbacks across Expo versions
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = String(hostUri || '').split(':')[0];
  return host || '';
}

export const API_BASE_URL = (() => {
  const env = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (env) return env;
  const host = guessDevHost();
  // Default to Vite dev server, which proxies API + Socket.IO to the backend.
  if (host) return `http://${host}:5173`;
  return 'http://localhost:5173';
})();
