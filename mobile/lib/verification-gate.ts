import { Alert } from 'react-native';

export const isVerificationRequiredError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return /profile photo verification required/i.test(err.message) || /verification required/i.test(err.message);
};

export const showVerificationRequiredPrompt = (onVerifyNow: () => void) => {
  Alert.alert(
    'Verification requise',
    "Verifiez votre profil pour acceder a plus de fonctionnalites (likes, super likes, passer) et inspirer confiance. Vous pouvez envoyer une photo maintenant.",
    [
      { text: 'Plus tard', style: 'cancel' },
      { text: 'Envoyer une photo', onPress: onVerifyNow },
    ]
  );
};
