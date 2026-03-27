import { Alert } from 'react-native';

export const isVerificationRequiredError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return /profile photo verification required/i.test(err.message) || /verification required/i.test(err.message);
};

export const showVerificationRequiredPrompt = (onVerifyNow: () => void) => {
  Alert.alert(
    'Verification requise',
    "Vous devez verifier votre profil photo avant de liker, super liker ou passer. Vous pouvez envoyer une photo maintenant.",
    [
      { text: 'Plus tard', style: 'cancel' },
      { text: 'Charger une photo', onPress: onVerifyNow },
    ]
  );
};
