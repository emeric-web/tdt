# TdT

Application web de gestion de tournois de tennis en simple.

## Installation locale

Prérequis : Node.js et Docker avec Docker Compose.

1. Créer la configuration locale avant d'installer les dépendances :

   ```bash
   cp .env.example .env
   ```

   Adapter `POSTGRES_PORT` et `DATABASE_URL` si le port PostgreSQL local 5432
   est déjà utilisé. Ne jamais committer `.env`.

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
   de démonstration.

5. Démarrer Next.js :

   ```bash
   npm run dev
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000).

## Getting Started

For day-to-day development, start the development server:

```bash
npm run dev
```

## Learn More

- `npm run db:generate` regenerates the Prisma client after schema changes.
- `npm run db:studio` opens Prisma Studio.
- `npm run lint`, `npm test` and `npm run build` run the quality checks.
