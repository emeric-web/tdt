# TdT

Application web de gestion de tournois de tennis en simple, à élimination directe : inscriptions, tirage du tableau, planning, déclaration puis confirmation des résultats par les joueurs, arbitrage, journal d'audit et anonymisation des comptes.

## Choix techniques

| Domaine          | Choix                                                       | Raison                                                                                              |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Application      | Next.js (App Router), React, TypeScript strict              | Un seul monolithe modulaire pour les pages et l'API, sans service supplémentaire à exploiter.       |
| API              | Route Handlers REST sous `src/app/api`                      | Contrat HTTP explicite, documenté dans `public/openapi.yaml` et servi par Swagger UI (`/api-docs`). |
| Base de données  | PostgreSQL 16 et Prisma (adaptateur `pg`)                   | Contraintes d'intégrité et transactions, utiles pour la validation conjointe vainqueur/score.       |
| Authentification | Auth.js (`next-auth`), fournisseur Credentials, session JWT | Comptes créés par un administrateur ; le rôle (`ADMIN` ou `MEMBER`) est porté par la session.       |
| Validation       | Zod                                                         | Les entrées de chaque route sont validées côté serveur ; les erreurs deviennent des `400`.          |
| Mots de passe    | bcryptjs                                                    | Seul le hash est stocké ; il n'est jamais exposé par l'API.                                         |
| Tests            | Vitest, Testing Library, Playwright                         | Tests unitaires et de composants rapides ; un parcours de bout en bout sur base isolée.             |
| Qualité          | ESLint, Prettier                                            | Conventions partagées par `npm run lint` et `npm run format:check`.                                 |

### Architecture du code

```text
src/
├── app/
│   ├── (site)/        Pages et composants React (accueil, tournois, matchs, administration)
│   ├── api/           Route Handlers : session, rôle, validation, délégation au service
│   └── api-docs/      Interface Swagger UI
├── server/            Logique back-end, un dossier par domaine
│   ├── auth/ tournaments/ matches/ users/ audit/
│   │   └── *.schemas.ts       schémas Zod
│   │   └── *.service.ts       règles métier
│   │   └── *.repository.ts    accès Prisma
│   ├── bracket/       Génération du tableau (fonctions pures)
│   ├── score/         Validation des scores (fonctions pures)
│   ├── errors/        Erreurs applicatives et traduction en réponses HTTP
│   └── db/            Client Prisma
├── lib/ et types/     Utilitaires et types partagés côté interface
└── generated/         Client Prisma généré (non versionné)
prisma/                Schéma, migrations et données de démonstration
e2e/                   Tests de bout en bout Playwright
```

Principes appliqués :

- **Séparation des couches** : une route valide l'entrée et vérifie les droits, le service applique les règles métier, le repository est la seule frontière avec Prisma.
- **Injection de dépendances** : les services reçoivent leur repository (et, pour l'authentification, la fonction de comparaison de mot de passe) en paramètre, ce qui permet de les tester avec de faux repositories.
- **Règles métier pures** : le générateur de tableau et le validateur de score n'ont aucune dépendance à React, à Prisma ou à HTTP.
- **Cohérence des données** : chaque match porte un numéro de `version` ; une mise à jour concurrente qui ne touche aucune ligne produit un `409`. La validation du résultat, l'avancement du vainqueur et la clôture éventuelle du tournoi s'exécutent dans une seule transaction.
- **Règle de contestation** : tant qu'une contestation est ouverte, le match n'a pas de vainqueur validé et aucun joueur n'avance.

### Sécurité et données personnelles

- Chaque page et chaque route métier exige une session ; les actions d'administration vérifient le rôle `ADMIN` côté serveur. Seule la documentation `/api-docs` est publique.
- Les erreurs sont normalisées (`{ "error": { "code", "message" } }`) avec les codes `400`, `401`, `403`, `404`, `409` et `500` ; aucune trace d'exécution n'est renvoyée au client.
- Le tableau n'expose ni les adresses e-mail ni les hashs de mot de passe. Le journal d'audit n'est lisible que par un administrateur.
- Les secrets viennent uniquement des variables d'environnement ; `.env` est ignoré par Git.
- L'anonymisation d'un compte remplace le nom par « Joueur supprimé », l'e-mail par une adresse technique unique et supprime le hash du mot de passe. L'identifiant est conservé pour garder des matchs et un audit cohérents. Les mentions légales et la politique de confidentialité sont accessibles depuis le pied de page.

## Configuration

Les variables sont lues depuis `.env` (modèle : `.env.example`).

| Variable                                                             | Rôle                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Paramètres du conteneur PostgreSQL de `docker-compose.yml` (lié à `127.0.0.1` uniquement).      |
| `DATABASE_URL`                                                       | URL de connexion utilisée par Prisma et l'application. Doit correspondre aux valeurs ci-dessus. |
| `NEXTAUTH_SECRET`                                                    | Secret de signature des sessions. Obligatoire ; une valeur aléatoire par environnement.         |
| `NEXTAUTH_URL`                                                       | URL publique de l'application, à définir hors développement local.                              |
| `SEED_PASSWORD`                                                      | Mot de passe partagé des comptes de démonstration (72 octets UTF-8 au maximum).                 |
| `E2E_DATABASE_URL`                                                   | Base dédiée aux tests de bout en bout ; son nom doit se terminer par `_e2e`.                    |

Les valeurs de `.env.example` sont réservées au développement local : en production, utiliser un mot de passe de base de données et un `NEXTAUTH_SECRET` propres, fournis par l'environnement d'hébergement.

## Installation locale

Prérequis : Node.js 24.14.1 (version indiquée dans `.nvmrc`) et Docker avec Docker Compose.

1. Créer la configuration locale avant d'installer les dépendances :

   ```bash
   cp .env.example .env
   ```

   Adapter `POSTGRES_PORT` et `DATABASE_URL` si le port PostgreSQL local 5432 est déjà utilisé. Définir `NEXTAUTH_SECRET` avec une valeur aléatoire (par exemple `openssl rand -base64 32`). Ne jamais committer `.env`.

2. Installer les dépendances :

   ```bash
   npm ci
   ```

   Le script `postinstall` lance `prisma generate` pour créer le client Prisma local à partir de `prisma/schema.prisma`. Il n'est pas nécessaire de committer le client généré.

3. Démarrer PostgreSQL :

   ```bash
   docker compose up -d db
   ```

4. Appliquer les migrations et charger les données de démonstration :

   ```bash
   npm run db:migrate -- --name init
   npm run db:seed
   ```

   `SEED_PASSWORD` dans `.env` définit le mot de passe local partagé des comptes de démonstration ; avec bcrypt, il doit tenir en 72 octets UTF-8 au maximum.

   Connectez-vous avec `admin@tdt.local` pour le compte administrateur ou `joueur01@tdt.local` pour un compte membre ; le mot de passe est la valeur locale de `SEED_PASSWORD`.

5. Démarrer Next.js :

   ```bash
   npm run dev
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000).

   La connexion se fait sur `/connexion`. Auth.js conserve la session dans un cookie JWT ; la déconnexion est disponible depuis la page de profil.
   La protection des pages et des routes métier exige un compte connecté. `/api-docs` reste public.
   Un administrateur peut créer des comptes membres depuis `/admin/membres/nouveau`.
   Les utilisateurs connectés consultent les tournois sur l'accueil ; les administrateurs peuvent en créer depuis `/admin/tournoi/nouveau`.
   Depuis la liste, un administrateur peut gérer les inscriptions et les têtes de série des tournois en préparation.

## Tests et qualité

| Commande                | Contenu                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `npm test`              | Tests unitaires, de services, de routes API et de composants |
| `npm run test:coverage` | Mêmes tests avec rapport de couverture (dossier `coverage/`) |
| `npm run test:e2e`      | Parcours de bout en bout (voir ci-dessous)                   |
| `npm run lint`          | Analyse ESLint                                               |
| `npm run typecheck`     | Vérification TypeScript sans émission de fichiers            |
| `npm run format:check`  | Vérification du formatage Prettier                           |
| `npm run build`         | Compilation de production                                    |

Les tests suivent le schéma Arrange–Act–Assert et isolent la base de données par de faux repositories ; seul le test E2E utilise PostgreSQL.

## Tests de bout en bout

Le test navigateur exécute le parcours réel de connexion, de déclaration du résultat, de confirmation par l'adversaire et d'avancement du vainqueur, sur une base PostgreSQL isolée.

1. Créer une base séparée (ne jamais faire pointer `E2E_DATABASE_URL` vers la base de développement ou de production) :

   ```bash
   docker compose exec db createdb -U tdt tdt_e2e
   ```

2. Renseigner `E2E_DATABASE_URL` dans `.env` avec cette base. Par exemple, adapter le port de l'hôte à `POSTGRES_PORT` :

   ```text
   E2E_DATABASE_URL=postgresql://tdt:tdt_dev_password@localhost:5432/tdt_e2e?schema=public
   ```

3. Installer le navigateur Playwright une seule fois, puis lancer le test :

   ```bash
   npx playwright install chromium
   npm run test:e2e
   ```

La commande E2E applique les migrations uniquement à la base configurée par `E2E_DATABASE_URL`, dont le nom doit se terminer par `_e2e`.
Les données de test utilisent des identifiants uniques et sont supprimées à la fin de l'exécution.

## Commandes utiles

- `npm run db:generate` régénère le client Prisma après une modification du schéma.
- `npm run db:migrate` crée et applique une migration en développement.
- `npm run db:seed` charge les données de démonstration.
- `npm run db:studio` ouvre Prisma Studio.
- `npm run format` applique Prettier.

## Déploiement

L'application est un seul service Next.js adossé à PostgreSQL, sans état local.

1. Fournir `DATABASE_URL`, `NEXTAUTH_SECRET` et `NEXTAUTH_URL` via l'environnement d'hébergement.
2. Appliquer les migrations sans les recréer : `npx prisma migrate deploy`.
3. Compiler puis démarrer : `npm run build` puis `npm run start`.
4. Ne pas exécuter `npm run db:seed` en production : il crée des comptes de démonstration.

Avec plusieurs instances, dimensionner le pool de connexions PostgreSQL en conséquence.
