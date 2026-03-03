# PROFYLE — Documentation Complète du Projet

## Propriétaire
**BELCADI Oussama** — 4IIR EMSI Tanger
Email : belcadioussama.eng@gmail.com | GitHub : blcoussama

---

## Vue d'ensemble du projet

**PROFYLE** est une plateforme de recrutement full-stack (MERN → MERN + PostgreSQL).
Elle permet à des recruteurs de poster des offres d'emploi et à des candidats de postuler,
communiquer en temps réel et gérer leur profil.

**Repo GitHub :** `git@github.com:blcoussama/PROFYLE.git`
**Version :** v2 (réécriture NestJS depuis Express)

---

## Objectif du projet

Ce projet est un **portfolio technique** ciblant les offres d'emploi ALTEN Maroc.
Il démontre :
- Full-stack MERN avancé avec NestJS + TypeScript
- Architecture propre (Clean Architecture, DI, modules)
- Tests réels (TDD, Jest, Supertest, Testcontainers, k6)
- DevOps complet (Docker, GitHub Actions CI/CD, AWS)
- API REST + GraphQL
- Real-time avec Socket.io
- Stockage fichiers AWS S3
- Bases de données polyglotes (MongoDB + PostgreSQL)

---

## Stack Technique

### Backend
| Technologie | Version | Rôle | Pourquoi |
|---|---|---|---|
| Node.js | 22 LTS | Runtime | Stable, performant, event-loop non-bloquant |
| NestJS | 11 | Framework | DI natif, modules, decorators, Swagger intégré |
| TypeScript | 5 | Langage | Type safety, autocomplétion, maintenabilité |
| Prisma | 7 | ORM PostgreSQL | Schema-first, types auto-générés, migrations propres |
| Mongoose | 9 | ODM MongoDB | Flexible, schemas dynamiques |
| MongoDB | — | DB documents | Users, Messages (schéma flexible) |
| PostgreSQL | — | DB relationnelle | Companies, Jobs, Applications, SavedJobs (ACID, relations) |
| Socket.io | — | WebSockets | Chat temps réel, présence en ligne |
| JWT | — | Auth | Access token (15min) + Refresh token (7j, httpOnly cookie) |
| bcryptjs | 3 | Hash passwords | Sécurité mots de passe |
| AWS S3 | — | Fichiers | Photos profil, logos, CVs PDF (remplace Cloudinary) |
| Nodemailer | — | Email | Vérification compte, reset password |
| Helmet | — | Sécurité | Security headers HTTP automatiques |
| class-validator | — | Validation | Decorators sur les DTOs |
| Joi | — | Validation env | Vérifie les variables d'environnement au démarrage |
| @nestjs/swagger | — | Documentation | OpenAPI/Swagger auto-généré |
| @nestjs/throttler | — | Rate limiting | Protection brute force |

### Frontend (à venir)
| Technologie | Rôle |
|---|---|
| React 19 | UI |
| TypeScript | Type safety |
| Redux Toolkit 2+ | State management |
| React Router 7+ | Navigation |
| Tailwind CSS | Styles |
| Shadcn/UI | Composants |
| Vite | Build tool |
| Axios | HTTP client |
| Socket.io-client | WebSocket client |
| React Testing Library | Tests composants |
| Cypress + Playwright | Tests E2E |

---

## Architecture

### Pourquoi MongoDB + PostgreSQL (polyglot persistence) ?

**MongoDB** → Users, Messages
- Schéma flexible (les profils candidat et recruteur n'ont pas les mêmes champs)
- Documents imbriqués (skills[], etc.)
- Pas de relations complexes nécessaires

**PostgreSQL** → Companies, Jobs, Applications, SavedJobs
- Données relationnelles (une Application appartient à un Job qui appartient à une Company)
- Contraintes ACID (une candidature ne peut pas exister sans le job correspondant)
- `onDelete: Cascade` : supprimer une Company → supprime ses Jobs → supprime leurs Applications
- Transactions : accepter une candidature = opération atomique

**Important :** `ownerId`, `recruiterId`, `applicantId` dans PostgreSQL sont des `String @db.Uuid`
(pas des foreign keys Prisma) car ils référencent des documents MongoDB — cross-DB, pas de FK possible.

### Style architectural : Clean Architecture via NestJS Modules
```
Controller (HTTP/WS)
    ↓
Service (logique métier)
    ↓
Repository / PrismaService / MongooseModel (accès données)
    ↓
Base de données
```

Pas de logique métier dans les controllers.
Pas d'accès DB direct dans les controllers.

### Module Resolution
- `module: commonjs` (pas nodenext) — compatibilité maximale avec npm packages
- Import Prisma client : `from '../../../generated/prisma/client'` (Prisma 7 génère `client.ts`, pas `index.ts`)

---

## Structure du projet

```
PROFYLE/
├── backend/                          ← NestJS API
│   ├── src/
│   │   ├── config/
│   │   │   ├── configuration.ts      ← Config typée (port, mongo, jwt, aws, email)
│   │   │   └── validation.schema.ts  ← Joi : validation env vars au démarrage
│   │   ├── database/
│   │   │   └── prisma/
│   │   │       ├── prisma.service.ts ← PrismaClient + lifecycle (connect/disconnect)
│   │   │       └── prisma.module.ts  ← @Global() : injectable partout sans re-import
│   │   ├── modules/                  ← (à créer : auth, users, companies, jobs, etc.)
│   │   ├── common/                   ← (à créer : guards, interceptors, filters, decorators)
│   │   ├── app.module.ts             ← Module racine : ConfigModule + Mongoose + Prisma
│   │   └── main.ts                   ← Helmet + cookies + CORS + Swagger + ValidationPipe
│   ├── prisma/
│   │   └── schema.prisma             ← Schéma PostgreSQL (4 tables + 1 enum)
│   ├── generated/
│   │   └── prisma/                   ← Client TypeScript auto-généré (gitignored)
│   │       └── client.ts             ← Point d'entrée du client Prisma
│   ├── test/                         ← Tests e2e NestJS
│   ├── .env                          ← Variables réelles (gitignored)
│   ├── .env.example                  ← Template (commité)
│   ├── prisma.config.ts              ← Config Prisma 7 (lit DATABASE_URL)
│   ├── tsconfig.json                 ← module: commonjs, strict TypeScript
│   └── package.json
├── frontend/                         ← React 19 + TypeScript (à migrer)
├── .gitignore                        ← Inclut CLAUDE-CODE-CHAT-HISTORY/, RAPPORT-LATEX/
└── CLAUDE.md                         ← Ce fichier
```

---

## Schéma PostgreSQL (Prisma)

### Tables
| Table | Clé primaire | Relations | Description |
|---|---|---|---|
| `companies` | UUID | → jobs[] | Entreprise créée par un recruteur |
| `jobs` | UUID | → company, applications[], savedBy[] | Offre d'emploi |
| `applications` | UUID | → job | Candidature (UNIQUE jobId+applicantId) |
| `saved_jobs` | UUID | → job | Favoris (UNIQUE jobId+userId) |

### Enum ApplicationStatus
`PENDING` → `ACCEPTED` | `REJECTED` | `WITHDRAWN`

### Suppressions en cascade
- Company supprimée → tous ses Jobs supprimés
- Job supprimé → toutes ses Applications + SavedJobs supprimés

---

## Variables d'environnement

Voir `.env.example` pour la liste complète.

| Groupe | Variables | Obligatoire |
|---|---|---|
| App | `NODE_ENV`, `PORT` | Non (defaults) |
| MongoDB | `MONGODB_URI` | Oui |
| PostgreSQL | `DATABASE_URL` | Oui (Prisma) |
| JWT | `JWT_ACCESS_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` | Oui |
| AWS S3 | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME` | Oui |
| Email | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Oui |
| CORS | `CLIENT_URL` | Non (default localhost:5173) |

**Validation au démarrage :** si une variable obligatoire est manquante → NestJS refuse de démarrer avec un message clair.

---

## Commandes de référence

```bash
# Démarrage développement
cd backend && npm run start:dev

# Build production
npm run build

# Tests
npm run test              # Jest unitaires
npm run test:cov          # avec coverage
npm run test:e2e          # tests e2e

# Prisma
npx prisma generate                    # Génère le client TypeScript (sans DB)
npx prisma migrate dev --name <nom>   # Crée + applique une migration
npx prisma migrate deploy              # Applique migrations en production
npx prisma studio                      # Interface visuelle DB (local)
npx prisma db push                     # Sync schema → DB sans migration (dev rapide)

# Git workflow
git checkout -b feat/<nom>             # Nouvelle feature branch
git add <fichiers>                     # Stage TOUJOURS avant commit
git commit -m "type(scope): message"   # Conventional Commits
git push -u origin feat/<nom>          # Push + crée branche remote
git push                               # Push suivants (branche déjà trackée)
```

---

## Workflow Git (à respecter)

### Branches
```
main                    ← code stable, deployable
feat/<module>           ← une feature = une branche
```

### Convention de commits (Conventional Commits)
```
feat(auth): add JWT refresh token rotation
fix(jobs): correct salary type validation
chore(config): add Joi validation schema
refactor(users): extract password hashing to utility
test(auth): add unit tests for login service
docs(readme): update env vars documentation
```

### Flow complet d'une feature
```
1. git checkout -b feat/auth
2. Écrire le code (TDD : tests d'abord)
3. git add <fichiers spécifiques>
4. git commit -m "feat(auth): ..."
5. git push -u origin feat/auth
6. Pull Request sur GitHub → merge → main
```

**Règle :** Ne jamais `git add .` sans vérifier ce qu'on stage. Toujours stager les fichiers explicitement.

---

## Règles de travail (notre méthode)

1. **Expliquer avant d'exécuter** — chaque commande doit être comprise avant d'être lancée
2. **Lire avant de modifier** — toujours lire un fichier avant de l'éditer
3. **Une feature = une branche** — jamais de développement direct sur main
4. **TDD** — pour les modules métier : écrire les tests avant le code
5. **Commit fréquent** — après chaque étape stable, pas en fin de journée
6. **Ne pas aller trop vite** — comprendre chaque étape avant la suivante
7. **Conventional Commits** — messages de commit descriptifs et standardisés

---

## État d'avancement

### ✅ Complété
- [x] Réécriture backend : Express → NestJS 11 + TypeScript
- [x] Setup ConfigModule avec validation Joi de toutes les env vars
- [x] Connexion MongoDB via MongooseModule
- [x] Connexion PostgreSQL via PrismaModule (@Global)
- [x] Schéma Prisma : Company, Job, Application, SavedJob
- [x] Configuration main.ts : Helmet, CORS, ValidationPipe, Swagger, cookieParser
- [x] `.env.example` complet
- [x] Fix tsconfig : commonjs (compatibilité packages npm)
- [x] Fix import Prisma 7 : `generated/prisma/client` (pas d'index.ts en Prisma 7)
- [x] Build propre : `npm run build` sans erreurs

### 🔄 En cours
- [ ] `feat/global-config` : commit + push + PR → main

### 📋 À faire (dans l'ordre)
- [ ] `feat/auth` — Module auth : JWT, refresh tokens, email verification, bcrypt
- [ ] `feat/users` — Module users : profils candidat/recruteur, upload avatar S3
- [ ] `feat/companies` — Module companies : CRUD entreprises
- [ ] `feat/jobs` — Module jobs : CRUD offres, filtres, pagination
- [ ] `feat/applications` — Module applications : postuler, statuts, TTL
- [ ] `feat/upload-s3` — Service upload AWS S3
- [ ] `feat/chat` — Module messages + Socket.io WebSockets
- [ ] `feat/graphql` — GraphQL endpoint (en plus REST)
- [ ] `feat/testing` — Tests Jest + Supertest + Testcontainers + k6
- [ ] `feat/frontend-migration` — React 19 + TypeScript migration
- [ ] `feat/docker-cicd` — Dockerfile + docker-compose + GitHub Actions

---

## Concepts clés NestJS expliqués

### @Module()
Unité de base NestJS. Chaque feature est un module avec ses controllers, services, et imports.

### @Injectable()
Marque une classe comme injectable par le système DI (Dependency Injection).
Au lieu d'instancier `new AuthService()`, NestJS le fait automatiquement et l'injecte là où c'est nécessaire.

### @Global()
Un module global n'a besoin d'être importé qu'une seule fois (dans AppModule).
Tous les autres modules peuvent injecter ses providers sans rien déclarer.
Utilisé pour : PrismaModule, ConfigModule (déjà global par `isGlobal: true`).

### Guards
Interceptent les requêtes avant qu'elles atteignent le controller.
Exemple : `JwtAuthGuard` vérifie le token JWT. Si invalide → 401 avant d'entrer dans le controller.

### Interceptors
Transforment les données avant/après le controller.
Exemple : `LoggingInterceptor` logue chaque requête/réponse.

### Pipes
Transforment et valident les données entrantes.
`ValidationPipe` (global dans main.ts) : valide le body selon le DTO, strip les champs inconnus.

### DTOs (Data Transfer Objects)
Classes TypeScript avec decorators `class-validator`.
Définissent la forme exacte attendue pour chaque requête.

```typescript
export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @Min(0)
  salary: number;
}
```

---

## Erreurs rencontrées et solutions

| Erreur | Cause | Solution |
|---|---|---|
| `Cannot find module '../../../generated/prisma'` | Prisma 7 génère `client.ts` pas `index.ts` | Importer `'../../../generated/prisma/client'` |
| `cookieParser is not callable` | `import * as` incompatible avec `nodenext` + CommonJS | `import cookieParser from 'cookie-parser'` |
| `module: nodenext` incompatible | Packages npm pas tous ESM-ready | Changer tsconfig vers `module: commonjs` |
| `git commit` sans effet | `git add` oublié avant le commit | Toujours stager avant de commiter |

---

## Notes importantes Prisma 7

- **Pas d'`index.ts`** dans le dossier généré → importer depuis `./generated/prisma/client`
- **`prisma.config.ts`** (nouveau en Prisma 6+) → gère la connexion DB séparément du schema
- **`generator client { provider = "prisma-client" }`** → nouveau nom du générateur (était `"prisma-client-js"`)
- **`output = "../generated/prisma"`** → client généré hors de `node_modules`, gitignored
- **`npx prisma generate`** → génère les types TypeScript sans besoin de connexion DB
- **`npx prisma migrate dev`** → a besoin d'une vraie connexion PostgreSQL
