# Deploiement backend avec MariaDB

Ce backend utilise maintenant MariaDB via Sequelize.

## 1. Important

Ce backend stocke encore les uploads en local dans :

- `backend/uploads`

Sur un hebergeur type Render, ce stockage n'est pas adapte a une vraie production durable.

Consequence :

- les photos et fichiers uploades peuvent disparaitre apres redemarrage ou redeploiement

Donc :

- pour des tests publics, ca peut suffire temporairement
- pour une vraie production Play Store, il faudra migrer les uploads vers un stockage persistant

Exemples classiques :

- Cloudinary
- AWS S3
- Cloudflare R2

## 2. Base de donnees

Le backend attend une base MariaDB accessible depuis le serveur Node.js.

Deux options de configuration sont supportees :

- une URL unique via `DATABASE_URL`
- ou des variables separees `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

Si la base impose TLS, activer aussi :

- `DB_SSL=true`

## 3. Backend

Render :

- connecter le depot Git
- Render detectera le fichier [render.yaml](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/render.yaml)
- renseigner `DATABASE_URL` avec l'URL MariaDB de ton fournisseur
- deployer le service `ndololy-backend`

## 4. Variables a renseigner

- `DATABASE_URL` ou `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`
- `DB_SSL`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `APP_NAME`
- `APP_FROM_EMAIL`

## 5. URL de verification

Une fois deploye, tester :

```text
https://ton-backend.onrender.com/health
```

Reponse attendue :

```json
{"status":"ok"}
```

## 6. Impact sur le mobile

Quand le backend public sera pret :

- le local peut rester sur `mobile/.env`
- la release Android devra utiliser une URL HTTPS publique

Exemple :

```text
https://ton-backend.onrender.com
```

## 7. Etape suivante utile

Si tu as deja des donnees MongoDB en production, il faudra ajouter un script d'import MongoDB -> MariaDB.
