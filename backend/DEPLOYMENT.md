# Deploiement backend gratuit

Ce projet peut etre deploye gratuitement pour un environnement public de test.

La combinaison la plus simple pour ce code aujourd'hui :

- backend Node.js sur Render
- base MongoDB sur MongoDB Atlas

## 1. Important

Ce backend stocke encore les uploads en local dans :

- `backend/uploads`

Sur un hebergeur gratuit type Render, ce stockage n'est pas adapte a une vraie production durable.

Consequence :

- les photos et fichiers uploades peuvent disparaitre apres redemarrage ou redeploiement

Donc :

- pour des tests publics, ca peut suffire temporairement
- pour une vraie production Play Store, il faudra migrer les uploads vers un stockage persistant

Exemples classiques :

- Cloudinary
- AWS S3
- Cloudflare R2

## 2. Option recommandee a cout zero pour commencer

### Base de donnees

MongoDB Atlas :

- creer un cluster M0 gratuit
- creer un utilisateur base de donnees
- ajouter l'IP `0.0.0.0/0` temporairement pour les tests
- recuperer l'URI MongoDB Atlas

### Backend

Render :

- connecter le depot Git
- Render detectera le fichier [render.yaml](C:/Users/YVES%20BOGMIS/Desktop/loveconnect/render.yaml)
- deployer le service `ndololy-backend`

## 3. Variables a renseigner sur Render

- `MONGODB_URI`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `APP_NAME`
- `APP_FROM_EMAIL`

## 4. URL de verification

Une fois deploye, tester :

```text
https://ton-backend.onrender.com/health
```

Reponse attendue :

```json
{"status":"ok"}
```

## 5. Impact sur le mobile

Quand le backend public sera pret :

- le local peut rester sur `mobile/.env`
- la release Android devra utiliser une URL HTTPS publique

Exemple :

```text
https://ton-backend.onrender.com
```

## 6. Etape suivante obligatoire pour une vraie prod

Avant publication large sur Play Store, il faudra faire au minimum :

1. stockage media persistant
2. variables de prod separees
3. domaine propre si possible
4. verification du flux email
