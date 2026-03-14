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
| @prisma/adapter-pg + pg | — | Driver PostgreSQL | Adaptateur obligatoire Prisma 7 — connexion TCP via `PrismaPg` |
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
- Import Prisma client : `from '@prisma/client'` (générateur `prisma-client-js` → génère dans `node_modules/.prisma/client/`, CJS compatible)

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

## Règle CLAUDE.md — Mise à jour obligatoire

**Après chaque étape ou tâche complétée, mettre à jour ce fichier :**
- Déplacer l'item de `📋 À faire` vers `✅ Complété`
- Mettre à jour la section `🔄 En cours`
- Ajouter les erreurs rencontrées + solutions dans la section dédiée
- Ajouter les nouvelles commandes découvertes dans la référence

Cette mise à jour se fait **avant le commit final** de chaque feature branch.

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

### ✅ Complété — `feat/global-config` (mergé dans main)
- [x] Réécriture backend : Express → NestJS 11 + TypeScript
- [x] Setup ConfigModule avec validation Joi de toutes les env vars
- [x] Connexion MongoDB via MongooseModule
- [x] Connexion PostgreSQL via PrismaModule (@Global)
- [x] Schéma Prisma : Company, Job, Application, SavedJob
- [x] Configuration main.ts : Helmet, CORS, ValidationPipe, Swagger, cookieParser
- [x] `.env.example` complet
- [x] Fix tsconfig : commonjs (compatibilité packages npm)
- [x] Fix Prisma 7 + NestJS CJS : générateur `prisma-client-js` → import depuis `'@prisma/client'` (évite ESM `import.meta.url` runtime error)
- [x] Build propre : `npm run build` sans erreurs

### ✅ Complété — `feat/auth` (build ✓, Swagger tests ✓)
- [x] Installation packages : `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `nodemailer`
- [x] `modules/users/schemas/user.schema.ts` — Mongoose User model (isEmailVerified, tokens, refreshToken hashé)
- [x] DTOs : `signup`, `login`, `verify-email`, `forgot-password`, `reset-password`
- [x] `email.service.ts` — Nodemailer SMTP (vérification email + reset password)
- [x] `auth.service.ts` — Logique métier complète : signup, verifyEmail, login, refresh, logout, forgotPassword, resetPassword
- [x] `jwt-access.strategy.ts` — Extrait JWT depuis header Authorization Bearer
- [x] `jwt-refresh.strategy.ts` — Extrait refresh token depuis cookie httpOnly
- [x] `jwt-auth.guard.ts` + `jwt-refresh.guard.ts`
- [x] `common/decorators/current-user.decorator.ts`
- [x] `auth.controller.ts` — 7 endpoints : POST signup/verify-email/login/refresh/logout/forgot-password/reset-password
- [x] `auth.module.ts` — assemblage complet
- [x] Build `npm run build` sans erreurs
- [x] Tests Swagger UI — 7 endpoints validés end-to-end : signup ✅ verify-email ✅ login ✅ refresh ✅ logout ✅ forgot-password ✅ reset-password ✅

### ✅ Complété — Documentation CLAUDE-CODE/explanations-backend/
- [x] `INDEX.md` — table des matières + ordre d'exécution + séparation natifs/créés
- [x] `00-SETUP-ET-DEPENDANCES.md` — NestJS CLI, tous les packages installés, prisma init, stratégie branches
- [x] `01-FICHIERS-RACINE.md` — tsconfig, package.json, eslint, prettier
- [x] `02-ENVIRONMENT-ET-PRISMA.md` — .env, prisma.config.ts, schema.prisma
- [x] `03-CONFIG-MODULE.md` — configuration.ts, validation.schema.ts
- [x] `04-BOOTSTRAP.md` — main.ts, app.module.ts (app.get, CORS, ValidationPipe)
- [x] `05-APP-DEFAULTS-ET-DATABASE.md` — app.controller/service, Jest, prisma.service/module, pool connexions
- [x] `06-AUTH-MODULE.md` — tous les fichiers auth (22 fichiers)
- [x] `07-GIT-ET-GITHUB.md` — branches, workflow, commandes
- [x] `08-SWAGGER.md` — OpenAPI, DocumentBuilder, decorators, utilisation UI
- [x] `09-MONGOOSE-VS-PRISMA.md` — Mongoose vs Prisma : qui parle à quelle base, schéma visuel
- [x] `10-COMMANDES-REFERENCE.md` — mongosh, psql, Prisma CLI, npm scripts, Git, npm install
- [x] `11-TESTS.md` — Les 3 types de tests : Swagger manuel, Jest unitaires, Jest e2e (complet)
- [x] `12-EMAIL-NODEMAILER.md` — Nodemailer vs services SMTP, Gmail App Password
- [x] `13-NESTJS-LIFECYCLE.md` — onModuleInit, onModuleDestroy, connexions zombie
- [x] `14-USERS-MODULE.md` — Module Users complet : profils, S3, AWS IAM/Billing, presigned URLs, Jest 26 tests

### ✅ Complété — `feat/users` (build ✓, Swagger tests ✓, Jest 26/26 ✓)
- [x] Installation packages : `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `uuid`, `@types/uuid`, `@types/multer`
- [x] `user.schema.ts` — étendu : classes `Experience` + `Education` (@Schema _id:false) + champs profil communs + candidat + recruteur
- [x] `dto/update-candidate-profile.dto.ts` — `ExperienceDto`, `EducationDto`, `UpdateCandidateProfileDto` (ValidateNested + @Type)
- [x] `dto/update-recruiter-profile.dto.ts` — `UpdateRecruiterProfileDto`
- [x] `users.service.ts` — S3Client dans constructeur, 7 méthodes : getMyProfile, updateMyProfile, uploadAvatar, deleteAvatar, uploadCv, getCvPresignedUrl, deleteCv
- [x] `users.controller.ts` — 7 endpoints, @UseGuards(JwtAuthGuard) au niveau classe, FileInterceptor pour uploads
- [x] `users.module.ts` — assemblage + exports UsersService
- [x] `app.module.ts` — ajout UsersModule
- [x] AWS S3 setup : bucket `profyle-uploads-820242925162-eu-west-3-an` (Paris, Account Regional namespace)
- [x] AWS IAM : IAM Admin `oussama-admin` (MFA activé) + IAM App User `profyle-s3-user` (inline policy moindre privilège)
- [x] Bucket policy : public uniquement sur `avatars/*`, CVs privés via presigned URLs
- [x] AWS Billing : accès billing activé pour IAM + Zero Spend Budget `profyle-zero-spend`
- [x] Build `npm run build` sans erreurs, ESLint 0 erreurs
- [x] Tests Swagger UI — 7 endpoints validés : GET me ✅ PATCH me ✅ POST avatar ✅ DELETE avatar ✅ POST cv ✅ GET cv-url ✅ DELETE cv ✅
- [x] Jest unitaires — 26/26 tests passent

### 🔄 En cours
- [ ] Commit + PR + merge `feat/users` → `main`

### 📋 À faire (dans l'ordre)
- [ ] Commit + PR + merge `feat/users` → `main`
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
| `exports is not defined in ES module scope` dans `dist/generated/prisma/client.js` | `prisma-client` (nouveau générateur Prisma 7) génère du TypeScript ESM (`import.meta.url`) incompatible avec `module: commonjs` | Changer le générateur vers `prisma-client-js` dans `schema.prisma` → importer depuis `'@prisma/client'` |
| `PrismaClientInitializationError: needs to be constructed with valid PrismaClientOptions` | Prisma 7 supprime `url` du schema — le runtime client n'a pas de connexion DB | Installer `@prisma/adapter-pg` + `pg`, passer `new PrismaPg({ connectionString })` au `super({ adapter })` dans `PrismaService` |
| `cookieParser is not callable` | `import * as` incompatible avec `nodenext` + CommonJS | `import cookieParser from 'cookie-parser'` |
| `module: nodenext` incompatible | Packages npm pas tous ESM-ready | Changer tsconfig vers `module: commonjs` |
| `git commit` sans effet | `git add` oublié avant le commit | Toujours stager avant de commiter |
| `expiresIn: Type 'string' not assignable to 'StringValue'` | `@nestjs/jwt` attend le type `StringValue` de la lib `ms`, pas `string` générique | Importer `StringValue` depuis `ms` : `import type { StringValue } from 'ms'` puis `config.get<StringValue>('jwt.accessExpiry')` |
| `secretOrKey: string \| undefined not assignable to string \| Buffer` | `config.get<string>()` peut théoriquement retourner `undefined` | Ajouter `!` non-null assertion : `config.get<string>('jwt.accessSecret')!` |
| Strategy overload TypeScript error (`passReqToCallback`) | TypeScript ne résout pas le bon overload `StrategyOptionsWithRequest` | Utiliser `passReqToCallback: true as const` |
| ESLint `no-unsafe-assignment` sur `request.user` dans le decorator | `getRequest()` retourne `any` | `getRequest<Request>()` + caster `user` en `Record<string, unknown>` |
| ESLint `no-unsafe-assignment` sur `req.cookies.RefreshToken` | `req.cookies` est typé `any` par express | Caster : `(req.cookies as Record<string, string>)['RefreshToken']` |
| ESLint `no-floating-promises` sur `bootstrap()` dans `main.ts` | Promise non-awaited et non-gérée | Préfixer avec `void` : `void bootstrap()` |
| ESLint `no-unnecessary-type-assertion` + `no-unsafe-assignment` sur `as any` dans generateTokens | `config.get()` sans type param retourne déjà `any`, donc `as any` est redondant | Utiliser `config.get<StringValue>()` — supprime le besoin du cast et des eslint-disable |

---

## Notes importantes Prisma 7

- **Utiliser `prisma-client-js`** (pas `prisma-client`) avec NestJS `module: commonjs` — le nouveau `prisma-client` génère du TypeScript ESM incompatible avec CJS
- **`provider = "prisma-client-js"`** → génère dans `node_modules/.prisma/client/`, importé via `'@prisma/client'`
- **`url` SUPPRIMÉ du schema** — Prisma 7 interdit `url = env(...)` dans `schema.prisma`. À la place :
  - CLI (migrations) → `datasource.url` dans `prisma.config.ts`
  - Runtime → passer un **adapter** au constructeur : `new PrismaClient({ adapter })`
- **`@prisma/adapter-pg` + `pg`** → adapter obligatoire pour PostgreSQL : `new PrismaPg({ connectionString: process.env['DATABASE_URL'] })`
- **`prisma.config.ts`** (nouveau en Prisma 6+) → gère la connexion DB pour le CLI uniquement
- **`npx prisma generate`** → génère les types TypeScript sans besoin de connexion DB
- **`npx prisma migrate dev`** → a besoin d'une vraie connexion PostgreSQL
