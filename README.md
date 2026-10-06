# TdT

Application web de gestion de tournois de tennis en simple.

## Installation locale

Prérequis : Node.js et Docker avec Docker Compose.

1. Créer la configuration locale avant d'installer les dépendances :

   ```bash
   cp .env.example .env
   ```

   Adapter `POSTGRES_PORT` et `DATABASE_URL` si le port PostgreSQL local 5432
   est déjà utilisé. Définir `NEXTAUTH_SECRET` avec une valeur aléatoire (par
   exemple `openssl rand -base64 32`). Ne jamais committer `.env`.

2. Installer les dépendances :

   ```bash
   npm ci
   ```

   Le script `postinstall` lance `prisma generate` pour créer le client Prisma
   local à partir de `prisma/schema.prisma`. Il n'est pas nécessaire de committer
   le client généré.

3. Démarrer PostgreSQL :

   ```bash
   docker compose up -d db
   ```

4. Appliquer les migrations et charger les données de démonstration :

   ```bash
   npm run db:migrate -- --name init
   npm run db:seed
   ```

   `SEED_PASSWORD` dans `.env` définit le mot de passe local partagé des comptes
   de démonstration ; avec bcrypt, il doit tenir en 72 octets UTF-8 au maximum.

   Connectez-vous avec `admin@tdt.local` pour le compte administrateur ou
   `joueur01@tdt.local` pour un compte membre ; le mot de passe est la valeur
   locale de `SEED_PASSWORD`.

5. Démarrer Next.js :

   ```bash
   npm run dev
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000).

   La connexion se fait sur `/login`. Auth.js conserve la session dans un cookie
   JWT ; la déconnexion est disponible depuis l'accueil. La protection des pages
   et des routes métier exige un compte connecté. `/api-docs` reste public.
   Un administrateur peut créer des comptes membres depuis `/admin/users`.
   Les utilisateurs connectés consultent les tournois sur l'accueil ; les
   administrateurs peuvent en créer depuis `/admin/tournaments`.
   Depuis la liste, un administrateur peut gérer les inscriptions et les têtes
   de série des tournois en préparation.

## Getting Started

For day-to-day development, start the development server:

```bash
npm run dev
```

## End-to-end tests

The browser test runs the real login, result declaration, opponent confirmation,
and winner advancement flow against an isolated PostgreSQL database.

1. Create a separate database (never point `E2E_DATABASE_URL` at the development
   or production database):

   ```bash
   docker compose exec db createdb -U tdt tdt_e2e
   ```

2. Set `E2E_DATABASE_URL` in `.env` to that database. For example, adjust the
   host port to match `POSTGRES_PORT`:

   ```text
   E2E_DATABASE_URL=postgresql://tdt:tdt_dev_password@localhost:5432/tdt_e2e?schema=public
   ```

3. Install the Playwright browser once and run the test:

   ```bash
   npx playwright install chromium
   npm run test:e2e
   ```

The E2E command applies migrations only to the database configured by
`E2E_DATABASE_URL`, whose name must end in `_e2e`. Test fixtures use unique IDs
and are removed after the run.

## Learn More

- `npm run db:generate` regenerates the Prisma client after schema changes.
- `npm run db:studio` opens Prisma Studio.
- `npm run lint`, `npm test`, `npm run test:e2e` and `npm run build` run the
  quality checks.
