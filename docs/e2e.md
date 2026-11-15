# Tests de bout en bout (Playwright)

Les parcours de KwikVote dans un vrai navigateur (Chromium), contre l'application
compilée (`next build` puis `next start`) branchée sur une base PostgreSQL
**locale**. Les tests sont dans `e2e/`, la configuration dans
`playwright.config.ts`.

## Lancer la suite en local, sans risque

```bash
# 1. une base jetable (le port est libre au choix)
docker run -d --rm --name kwikvote-e2e-pg -p 127.0.0.1:54329:5432 \
  -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# 2. les dépendances, le client Prisma et le navigateur (une fois)
pnpm install
npx prisma generate                       # ne touche à aucune base
pnpm exec playwright install chromium     # si Chromium 1248 n'est pas déjà là

# 3. la suite : compile l'application, pousse le schéma, lance les tests
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres pnpm test:e2e

# 4. arrêter la base (--rm la supprime)
docker stop kwikvote-e2e-pg
```

Le rapport HTML est dans `playwright-report/` (`pnpm exec playwright show-report`),
les traces des échecs dans `test-results/`.

Variables utiles :

| Variable             | Effet                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`       | **obligatoire**, hôte `localhost`, `127.0.0.1` ou `::1` uniquement      |
| `E2E_SKIP_BUILD=1`   | réutilise le dernier build (`.next`) au lieu de recompiler              |
| `E2E_WORKERS=n`      | nombre de navigateurs en parallèle (4 par défaut)                       |
| `E2E_PORT=n`         | port de l'application (3217 par défaut ; n+1 et n+2 pour les doublures) |
| `E2E_A11Y_VERBOSE=1` | affiche le détail des avertissements d'accessibilité (axe)              |

Exemples : `pnpm test:e2e e2e/securite.spec.ts`,
`pnpm test:e2e -g "headers"`, `pnpm test:e2e --headed`.

## Pourquoi c'est sans risque

Le `.env` du projet peut pointer vers la base de **production** et contenir les
vraies clés (webhook Discord, VAPID). La suite ne s'en sert jamais :

- `playwright.config.ts` refuse de démarrer si `DATABASE_URL` est absent ou si
  son hôte n'est pas local (`e2e/support/env.ts`), **avant** de compiler ou de
  lancer quoi que ce soit. Playwright ne lit pas le `.env`.
- Le serveur reçoit **toutes** les variables de `lib/env.ts` (Next.js ne
  remplace jamais une variable déjà définie par celle d'un `.env`) : base
  locale, mot de passe d'administration de test, clés VAPID générées pour les
  tests, webhook Discord vers la doublure locale.
- Le schéma est poussé (`prisma db push`) par `e2e/support/global-setup.ts`,
  avec l'URL locale vérifiée passée explicitement. Ne lancez pas `pnpm build`,
  `pnpm prisma` ni `cron.js` à la main : ils lisent le `.env`.
- Aucune requête ne sort de la machine :
  - le **service push** et le **webhook Discord** sont un faux serveur HTTPS
    local (`e2e/support/fake-services.mjs`, certificat autosigné généré dans
    `e2e/.tmp/` avec `openssl` et approuvé par le seul serveur de test via
    `NODE_EXTRA_CA_CERTS`) qui enregistre les requêtes ;
  - côté navigateur, `Notification`, le service worker et `PushManager` sont
    remplacés par des doublures (`e2e/support/browser-mocks.ts`) : l'abonnement
    a une adresse vers le faux service et de vraies clés, ce qui permet de
    **déchiffrer** dans les tests les notifications envoyées par le serveur
    (`e2e/support/push.ts`) ;
  - le script d'analytics (umami) est bloqué.

## Organisation

| Fichier                    | Parcours                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `securite.spec.ts`         | en-têtes de sécurité (pages, actions serveur, service worker), statistiques sans query string   |

Règles suivies :

- sélecteurs accessibles uniquement (rôle et nom, libellés) ;
- pas d'attente fixe : assertions qui réessaient (`expect`, `expect.poll`) ;
- données isolées : chaque test crée ses propres sondages (titres uniques), les
  tests tournent en parallèle sur la même base ;
- un contexte de navigateur par participant (son propre stockage local, donc
  ses propres votes) ;
- dates relatives au jour du lancement, calculées en heure de Paris
  (navigateur et serveur en `Europe/Paris`) ;
- pas de nouvel essai automatique (`retries: 0`) : un test instable doit être
  corrigé, pas masqué.

## Accessibilité (axe)

`checkA11y(page, "libellé")` lance axe (WCAG 2.2 A/AA) sur les pages et
dialogues traversés, **en mode avertissement** : une violation ne fait jamais
échouer un test. Elle est ajoutée au test (annotation `a11y` et pièce jointe
JSON dans le rapport HTML) et résumée à la fin du lancement. La souris est
écartée et les animations terminées avant chaque analyse, pour des résultats
reproductibles.

## Ce qui n'est pas couvert

- `cron.js` (ouverture des réinscriptions à l'heure dite) : il faudrait attendre
  l'heure réelle.
- La réception réelle des notifications par un navigateur (service worker,
  affichage) : le service push est simulé.
- Firefox et WebKit : seul Chromium est lancé.
