# LoveConnect / NDOLOLY

Projet complet de site de rencontre avec :

- un backend `Node.js + Express + MariaDB`
- un frontend web `Vue 3 + Vite`
- une application mobile `React Native + Expo + Expo Router`
- un dashboard administrateur web connecte au meme backend

Ce README est ecrit pour qu'un debutant puisse :

- comprendre la structure du projet
- lancer chaque partie localement
- configurer l'environnement
- creer un compte administrateur
- tester l'application web, mobile et le dashboard
- diagnostiquer les erreurs les plus frequentes

## 1. Vue d'ensemble

Le depot est organise en trois applications principales :

- `backend/` : API, authentification, matching, messages, moderation, administration
- `frontend/` : interface web utilisateur + dashboard admin
- `mobile/` : application mobile Expo pour Android/iOS

Flux global :

1. le frontend web et le mobile appellent le backend HTTP
2. le backend lit et ecrit dans MariaDB
3. les uploads sont stockes localement dans `backend/uploads`
4. le dashboard admin utilise la meme API que l'application

## 2. Arborescence utile

```text
loveconnect/
|- backend/
|  |- src/
|  |  |- db.js
|  |  |- index.js
|  |  |- middleware/
|  |  |- routes/
|  |  `- services/
|  |- scripts/
|  |  `- seed-admin.js
|  |- uploads/
|  |- .env
|  `- package.json
|- frontend/
|  |- src/
|  |  |- views/
|  |  |- views/admin/
|  |  `- assets/
|  |- .env
|  `- package.json
|- mobile/
|  |- app/
|  |- components/
|  |- lib/
|  |- .env
|  |- app.json
|  `- package.json
`- README.md
```

## 3. Stack technique

### Backend

- `Node.js`
- `Express`
- `MariaDB + Sequelize`
- `Socket.IO`
- `JWT`
- `Multer` pour les uploads

### Frontend web

- `Vue 3`
- `Vite`
- `Axios`

### Mobile

- `Expo`
- `React Native`
- `TypeScript`
- `Expo Router`
- `expo-notifications`
- `expo-image-picker`

## 4. Prerequis

A installer sur la machine :

- `Node.js` 20+ ou plus recent
- `npm`
- `MariaDB`
- pour le mobile :
  - soit `Expo Go` sur telephone
  - soit Android Studio + SDK Android si tu veux un emulateur Android natif

## 5. Attention Windows

Le chemin du projet contient un espace :

`C:\Users\YVES BOGMIS\Desktop\loveconnect`

Sous PowerShell, utilise toujours des guillemets :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
```

Si tu oublies les guillemets, PowerShell coupe le chemin et les commandes echouent.

## 6. Variables d'environnement

### Backend

Fichier : [backend/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/.env)

Exemple minimal :

```env
PORT=4000
JWT_SECRET=change_me_in_production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=loveconnect
DB_USER=root
DB_PASSWORD=
DB_SSL=false
```

Variables email actuellement utilisees dans le projet :

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false
APP_NAME="NDOLOLY"
APP_FROM_EMAIL="NDOLOLY"
```

### Frontend

Fichier : [frontend/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/.env)

```env
VITE_API_URL=http://localhost:4000
```

### Mobile

Fichier : [mobile/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/.env)

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.141:4000
EXPO_OFFLINE=1
EXPO_NO_TELEMETRY=1
```

Important :

- pour le frontend web, `localhost` est correct
- pour le mobile sur telephone physique, il faut mettre l'IP locale du PC, pas `localhost`
- exemple : `http://192.168.1.141:4000`

## 7. Installation

### Backend

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm install
```

### Frontend

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\frontend"
npm install
```

### Mobile

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npm install
```

## 8. Demarrage des services

Le depot racine ne possede pas de script global pour tout lancer. Chaque application se lance separement.

### 8.1 Demarrer le backend

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run start
```

Resultat attendu :

```text
NDOLOLY API listening on 4000
```

Test rapide :

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/health
```

Reponse attendue :

```json
{"status":"ok"}
```

### 8.2 Demarrer le frontend web

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\frontend"
npm run dev
```

Ouvre ensuite :

- application web : `http://localhost:5173`
- dashboard admin : `http://localhost:5173/admin`

### 8.3 Demarrer le mobile Expo

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx expo start --lan
```

Puis :

- scanne le QR code avec `Expo Go`
- ou appuie sur `a` si un environnement Android natif est configure

### 8.4 Demarrage recommande dans trois fenetres

Fenetre 1 :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run start
```

Fenetre 2 :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\frontend"
npm run dev
```

Fenetre 3 :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx expo start --lan
```

## 9. Arreter et redemarrer proprement

Pour arreter un service, fais `Ctrl + C` dans sa fenetre.

Si un port reste occupe :

```powershell
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

Ports courants :

- backend : `4000`
- frontend Vite : `5173`
- Expo/Metro : `8081` ou `8083`
- Expo services : `19000`, `19001`, `19002`

## 10. Base de donnees

Base MariaDB attendue par defaut :

```text
host=127.0.0.1
port=3306
database=loveconnect
user=root
```

La connexion est definie dans [backend/src/db.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/db.js). Tu peux aussi utiliser `DATABASE_URL`.

## 11. Creer un compte administrateur

Le dashboard admin necessite un utilisateur avec `role: "admin"`.

Commande :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run seed:admin -- admin@ndololy.com MotDePasseFort123
```

Script utilise :

[seed-admin.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/scripts/seed-admin.js)

Connexion admin ensuite :

- URL : `http://localhost:5173/admin`
- email : `admin@ndololy.com`
- mot de passe : `MotDePasseFort123`

## 12. Import MongoDB vers MariaDB

Si tu as encore une ancienne base MongoDB, un script d'import est disponible :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run import:mongo -- --mongo-uri=mongodb://127.0.0.1:27017/loveconnect
```

Pour vider d'abord les tables MariaDB cibles :

```powershell
npm run import:mongo -- --mongo-uri=mongodb://127.0.0.1:27017/loveconnect --force
```

Variables compatibles :

- `MONGO_SOURCE_URI`
- `MONGO_SOURCE_DB`

## 13. Fonctionnalites principales du projet

### Cote utilisateur

- inscription
- activation par code
- connexion
- edition du profil
- upload de photos
- verification photo
- decouverte de profils
- likes, super likes, pass
- matchs
- messages
- audio dans les conversations
- vues de profil
- likes recus
- premium
- mode incognito

### Cote admin

- connexion admin dediee
- vue d'ensemble du dashboard
- gestion utilisateurs
- suspension / restauration
- activation / retrait premium
- activation / retrait badge photo
- verrou `reverification_required`
- moderation des signalements
- gestion des verifications photo
- consultation des conversations d'un utilisateur
- suppression des photos d'un profil
- statistiques globales

## 13. Logique metier importante

### 13.1 Verification photo

Workflow actuel :

1. l'utilisateur soumet une photo de verification
2. l'admin approuve ou rejette
3. tant que `verified_photo !== true`, l'utilisateur ne peut pas :
   - liker
   - super liker
   - passer
4. si l'admin retire la validation :
   - `verified_photo = false`
   - `reverification_required = true`
   - le compte est bloque jusqu'a nouvelle soumission

### 13.2 Premium

Workflow actuel :

- seuls les comptes premium peuvent voir qui les a likes
- seuls les comptes premium peuvent activer `incognito_mode`
- si le premium est retire, l'incognito est coupe automatiquement

### 13.3 Admin

Le dashboard admin est servi par le frontend web et consomme les routes `/admin/*` du backend.

## 14. Endpoints utiles

### Auth

- `POST /auth/register`
- `POST /auth/verify`
- `POST /auth/login`
- `POST /auth/admin/login`

### Profil

- `GET /profile/me`
- `PUT /profile/me`
- `GET /profile/verification-status`
- `POST /profile/verify-request`
- `GET /profile/discover`
- `GET /profile/nearby`

### Matching

- `POST /match/like`
- `POST /match/superlike`
- `POST /match/pass`
- `GET /match/list`
- `GET /match/liked-me`
- `GET /match/likes`

### Messages

- `GET /messages/:matchId`
- `POST /messages/:matchId`

### Admin

- `GET /admin/overview`
- `GET /admin/users`
- `PATCH /admin/users/:id`
- `GET /admin/reports`
- `POST /admin/reports/:id/review`
- `GET /admin/verifications`
- `POST /admin/verifications/:id/decision`
- `GET /admin/users/:id/conversations`
- `DELETE /admin/users/:id/photos`

## 15. Fichiers cles a connaitre

### Backend

- [index.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/index.js) : point d'entree API
- [db.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/db.js) : modeles Sequelize et connexion MariaDB
- [auth.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/routes/auth.js) : inscription, login, login admin
- [profile.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/routes/profile.js) : profil, verification photo, decouverte
- [match.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/routes/match.js) : likes, super likes, pass, matches
- [message.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/routes/message.js) : messagerie
- [admin.js](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/backend/src/routes/admin.js) : dashboard admin

### Frontend

- [App.vue](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/App.vue) : shell principal
- [AdminDashboard.vue](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/views/admin/AdminDashboard.vue) : dashboard admin
- [AdminLogin.vue](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/views/admin/AdminLogin.vue) : login admin
- [Profile.vue](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/views/Profile.vue) : profil web
- [Likes.vue](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/views/Likes.vue) : likes web
- [style.css](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/frontend/src/assets/style.css) : styles globaux

### Mobile

- [app.json](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/app.json) : config Expo
- [profile.tsx](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/app/(tabs)/profile.tsx) : profil mobile
- [encounters.tsx](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/app/(tabs)/encounters.tsx) : swipe
- [actions.tsx](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/app/(tabs)/actions.tsx) : likes recus / premium
- [messages.tsx](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/app/(tabs)/messages.tsx) : messagerie mobile
- [api.ts](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/lib/api.ts) : client HTTP mobile
- [auth-context.tsx](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/lib/auth-context.tsx) : session mobile

## 16. Expo Go sur telephone

Si tu ne veux pas configurer le SDK Android :

1. installe `Expo Go` sur le telephone
2. mets le telephone et le PC sur le meme Wi-Fi
3. verifie que [mobile/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/.env) pointe vers l'IP locale du PC
4. lance :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx expo start --lan
```

5. scanne le QR code

Test reseau utile depuis le telephone :

```text
http://IP_DU_PC:4000/health
```

Si ce lien ne marche pas dans le navigateur du telephone, l'app mobile ne marchera pas non plus.

## 17. Dashboard admin

URL :

`http://localhost:5173/admin`

Fonctions disponibles :

- consultation des utilisateurs
- filtres par statut
- consultation des conversations
- gestion des photos du profil
- moderation des verifications photo
- statistiques globales

## 18. Depannage

### Erreur PowerShell sur `cd`

Cause :

- chemin avec espace non entoure de guillemets

Correct :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
```

### `npm error Missing script: "start"` ou `"dev"`

Cause :

- la commande a ete lancee depuis le mauvais dossier

Verifie le repertoire courant :

```powershell
pwd
```

Puis relance dans le bon dossier.

### `EADDRINUSE: address already in use :::4000`

Cause :

- un ancien backend tourne deja

Diagnostic :

```powershell
netstat -ano | findstr :4000
tasklist /FI "PID eq <PID>"
```

Arret :

```powershell
taskkill /PID <PID> /F
```

### Le mobile ne charge aucune donnee

Verifie :

1. backend demarre
2. telephone sur le meme Wi-Fi
3. `EXPO_PUBLIC_API_BASE_URL` dans [mobile/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/.env)
4. test navigateur telephone :

```text
http://IP_DU_PC:4000/health
```

### Le dashboard admin ne charge pas

Verifie :

1. backend lance
2. frontend lance
3. `VITE_API_URL=http://localhost:4000`
4. recharge le navigateur avec `Ctrl+F5`

### L'app mobile garde un ancien etat

Relance Expo avec cache propre :

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx expo start -c
```

Si besoin, vide les donnees de `Expo Go` sur le telephone.

## 19. Verifications rapides apres demarrage

### Backend

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/health
```

### Frontend

Ouvre :

`http://localhost:5173`

### Admin

Ouvre :

`http://localhost:5173/admin`

### Mobile

Scanne le QR code Expo et teste :

- connexion
- chargement du profil
- onglet rencontres
- messages

## 20. Etat actuel du projet

Le projet est fonctionnel en local avec :

- backend sur `4000`
- frontend sur `5173`
- mobile Expo via `Expo Go`
- dashboard admin accessible via `/admin`

A garder en tete :

- le mobile depend fortement de la bonne IP dans [mobile/.env](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/mobile/.env)
- le depot racine ne pilote pas automatiquement les trois apps
- les services doivent etre lances separement

## 21. Commandes de reference

### Backend

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run start
```

### Frontend

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\frontend"
npm run dev
```

### Mobile

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\mobile"
npx expo start --lan
```

### Seed admin

```powershell
cd "C:\Users\YVES BOGMIS\Desktop\loveconnect\backend"
npm run seed:admin -- admin@ndololy.com MotDePasseFort123
```
