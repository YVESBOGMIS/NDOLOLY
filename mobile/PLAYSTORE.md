# Publication Android / Play Store

Ce guide complete la configuration deja en place dans le projet `mobile/`.

Objectif :

- continuer a travailler en local avec le backend LAN actuel
- produire une APK de test
- produire un AAB de production pour Google Play
- soumettre vers la Play Console

## 1. Ce qui est deja configure

- `app.json`
  - `android.package = com.ndololy.app`
  - `android.versionCode = 1`
- `eas.json`
  - `preview` genere une `apk`
  - `production` genere un `aab`
  - `production` incremente automatiquement `versionCode`
  - `submit.production` cible Google Play
- `package.json`
  - `npm run build:android:apk`
  - `npm run build:android:aab`
  - `npm run submit:android:play`

## 2. Important : ne pas casser le local

Ton mode local reste base sur :

- [mobile/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/.env)
- `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.141:4000`

Ne change pas ce fichier pour la production.

Pour la release Play Store, utilise un environnement EAS `production` avec une URL backend publique HTTPS.

Exemple :

```text
https://api.ndololy.com
```

## 3. Prerequis compte

Il te faut :

1. un compte Expo
2. un compte Google Play Console
3. une URL backend de production en HTTPS

## 4. Connexion Expo

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx eas login
npx eas whoami
```

## 5. Variable d'environnement production

Creer la variable EAS de production :

```powershell
npx eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.ndololy.com --environment production --visibility plaintext
```

Tu peux aussi creer un environnement `preview` si tu veux une APK de test connectee a un backend de preproduction :

```powershell
npx eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://preprod.ndololy.com --environment preview --visibility plaintext
```

## 6. Build APK de test

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npm run build:android:apk
```

Resultat :

- une APK installable directement sur Android

## 7. Build Play Store en AAB

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npm run build:android:aab
```

Resultat :

- un fichier `.aab` pour Google Play

## 8. Keystore Android

Lors du premier build, EAS demandera comment gerer le keystore.

Choix recommande :

- `Generate new keystore`

Ensuite EAS le stockera pour les builds suivants.

Ne perds pas ce keystore. Sans lui, tu ne pourras pas publier les mises a jour de la meme application Android.

## 9. Google Play Console

Dans Google Play Console :

1. creer l'application
2. renseigner :
   - nom
   - description
   - icone
   - captures d'ecran
   - categorie
   - politique de confidentialite
   - Data safety
3. uploader le `.aab` dans `Internal testing` en premier

Je recommande de toujours commencer par :

- `Internal testing`

et seulement ensuite :

- `Closed testing`
- `Production`

## 10. Soumission automatisee avec EAS Submit

Pour automatiser la soumission, il faut un compte de service Google Play.

### 10.1 Creer le compte de service

Dans Google Cloud / Google Play :

1. creer un service account
2. generer une cle JSON
3. donner les droits Play Console a ce service account

### 10.2 Utiliser cette cle

Option simple :

```powershell
npx eas submit --platform android --profile production --key /chemin/vers/google-play-service-account.json
```

Option projet :

- stocker la cle hors git
- puis renseigner `serviceAccountKeyPath` dans `eas.json`

## 11. Ce qu'il ne faut pas faire

- ne pas publier une app qui pointe vers `192.168.x.x`
- ne pas changer l'identifiant `android.package` apres la premiere publication
- ne pas perdre le keystore
- ne pas tester la premiere fois directement en production

## 12. Checklist avant Play Store

- backend de production en HTTPS
- variable EAS `EXPO_PUBLIC_API_BASE_URL` configuree pour `production`
- compte Expo connecte
- compte Google Play Console pret
- keystore Android genere
- premier build `aab` reussi
- fiche Play Console remplie
- test interne valide

## 13. Commandes resume

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx eas login
npx eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.ndololy.com --environment production --visibility plaintext
npm run build:android:aab
```

Puis pour soumettre :

```powershell
npm run submit:android:play
```
