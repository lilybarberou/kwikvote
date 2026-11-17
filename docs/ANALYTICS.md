# Analytics de KwikVote

Ce document relie chaque question business à la donnée qui y répond. Il est écrit
d'abord pour les agents : ils décident des fonctionnalités, des correctifs, du
marketing et de la croissance à partir de ces chiffres. La propriétaire consulte
rarement les outils d'analytics.

Principes :

- Aucune donnée personnelle dans un résultat : jamais d'e-mail, de nom de votant,
  de texte de commentaire, de mot de passe ni d'endpoint push. Les requêtes ne
  renvoient que des comptes et des agrégats. L'e-mail ne sert qu'à compter des
  organisateurs distincts, à l'intérieur de la requête.
- Les noms des sections (A1, B2…) sont stables : citez-les dans vos comptes rendus.
- Lecture seule, toujours.

## Sources

| Source                                   | Ce qu'elle contient                                                                                                            | Accès pour un agent                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Base PostgreSQL de production            | Tout l'historique métier depuis mai 2024 : sondages, créneaux, votes, choix, commentaires, abonnements push, échéances du cron | SQL en lecture seule (voir plus bas) |
| Umami (`umami.lilybarberou.fr`)          | Pages vues seulement, sans paramètres d'URL (`data-exclude-search`). Aucun événement personnalisé                              | Aucun accès agent pour l'instant     |
| Notification Discord                     | Un message à chaque sondage créé (`lib/utils.server.ts`)                                                                       | Pas une source d'analyse             |
| Featurebase (`kwikvote.featurebase.app`) | Idées et votes des utilisateurs sur la roadmap                                                                                 | Page publique                        |

Aucun outil ne mesure aujourd'hui l'acquisition (d'où viennent les visiteurs) ni
les parcours (entonnoir de création, ouverture du formulaire de vote, refus du push).
Voir « Limites » et « Évolution proposée ».

## Lancer une requête en lecture seule

L'URL de la base de production est dans le `.env` du dépôt. Ne l'affichez jamais.
Le serveur est en PostgreSQL 17 : utilisez un client 17.

```bash
cd "/chemin/du/dépôt/kwikvote"
export PGURL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']$//")
export SQL='SELECT count(*) FROM "Poll";'
docker run --rm -e PGURL -e SQL -e PGOPTIONS='-c default_transaction_read_only=on' \
  postgres:17-alpine sh -c 'psql "$PGURL" -XA -F" | " -c "$SQL"'
```

`default_transaction_read_only=on` fait refuser toute écriture par le serveur. Ne
lancez jamais `pnpm build`, `pnpm prisma`, `prisma db push` ni `cron.js` avec ce
`.env` : ils écrivent en production.

## Rappels sur les données

- `Poll.type` : `1` = sondage libre, `2` = sondage avec liste d'attente (inscriptions).
- `VoteChoice.choice` : `1` = Oui, `2` = Non, `3` = Ne sais pas (sondages libres seulement).
- `Poll.timeBeforeAllowedType` (sondages avec liste d'attente) : `2` = les inscriptions
  hors liste n'ouvrent qu'un nombre d'heures avant le début du créneau (`msBeforeAllowed`).
- `Slot.registered`, `waitingList`, `waitingListReregistered`, `notComing` : tableaux
  d'identifiants de votes. Ils donnent l'état actuel du créneau, pas son historique.
  `notComing` contient les votes « Non » du créneau, pas des désistements.
- `Vote.updatedAt` ne garde que la dernière modification.
- `_SubscriptionToVote` : table de liaison Prisma, `"A"` = endpoint de l'abonnement,
  `"B"` = identifiant du vote.
- Supprimer un sondage supprime en cascade ses créneaux, votes et commentaires :
  l'historique ne contient que les sondages encore présents.

## A. Activité et organisateurs

### A1. Combien de sondages sont créés chaque mois, et de quel type ?

```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mois,
       count(*) AS sondages,
       count(*) FILTER (WHERE type = 1) AS libres,
       count(*) FILTER (WHERE type = 2) AS liste_attente
FROM "Poll" GROUP BY 1 ORDER BY 1;
```

### A2. Combien d'organisateurs distincts sont actifs chaque mois ?

Un organisateur = une adresse e-mail distincte saisie à la création. Les sondages
sans e-mail sont comptés à part.

```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mois,
       count(DISTINCT lower(trim(email))) FILTER (WHERE email <> '') AS organisateurs,
       count(*) FILTER (WHERE email = '') AS sondages_sans_email
FROM "Poll" GROUP BY 1 ORDER BY 1;
```

### A3. Les organisateurs reviennent-ils ? (sondages par organisateur)

```sql
WITH o AS (
  SELECT lower(trim(email)) AS e, count(*) AS n
  FROM "Poll" WHERE email <> '' GROUP BY 1
)
SELECT CASE WHEN n = 1 THEN '1 sondage' WHEN n <= 3 THEN '2 à 3'
            WHEN n <= 10 THEN '4 à 10' ELSE '11 et plus' END AS tranche,
       count(*) AS organisateurs, sum(n) AS sondages
FROM o GROUP BY 1 ORDER BY min(n);
```

### A4. Combien d'organisateurs sont actifs, nouveaux ou partis ?

```sql
WITH o AS (
  SELECT lower(trim(email)) AS e, min("createdAt") AS premier, max("createdAt") AS dernier
  FROM "Poll" WHERE email <> '' GROUP BY 1
)
SELECT count(*) AS organisateurs,
       count(*) FILTER (WHERE dernier > now() - interval '90 days') AS actifs_90j,
       count(*) FILTER (WHERE premier > now() - interval '90 days') AS nouveaux_90j,
       count(*) FILTER (WHERE dernier <= now() - interval '90 days') AS inactifs_depuis_90j
FROM o;
```

### A5. Tous les combien un organisateur récurrent recrée-t-il un sondage ?

```sql
WITH p AS (
  SELECT "createdAt",
         lag("createdAt") OVER (PARTITION BY lower(trim(email)) ORDER BY "createdAt") AS precedent
  FROM "Poll" WHERE email <> ''
)
SELECT count(*) AS intervalles,
       (percentile_disc(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "createdAt" - precedent) / 86400))::int AS mediane_jours,
       (percentile_disc(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM "createdAt" - precedent) / 86400))::int AS p90_jours
FROM p WHERE precedent IS NOT NULL;
```

## B. Votes

### B1. Combien de votes chaque mois, et combien sont modifiés ?

```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mois,
       count(*) AS votes,
       count(*) FILTER (WHERE "updatedAt" > "createdAt" + interval '1 minute') AS modifies_ensuite
FROM "Vote" GROUP BY 1 ORDER BY 1;
```

### B2. Combien de votes reçoit un sondage ?

```sql
SELECT type, count(*) AS sondages,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY n) AS mediane,
       percentile_disc(0.9) WITHIN GROUP (ORDER BY n) AS p90,
       max(n) AS max, count(*) FILTER (WHERE n = 0) AS sans_vote
FROM (SELECT p.id, p.type, count(v.id) AS n
      FROM "Poll" p LEFT JOIN "Vote" v ON v."pollId" = p.id
      GROUP BY p.id, p.type) s
GROUP BY type ORDER BY type;
```

### B3. Combien de temps après la création les gens votent-ils ?

```sql
SELECT (percentile_disc(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM v."createdAt" - p."createdAt") / 3600))::numeric(10,1) AS mediane_heures,
       (percentile_disc(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM v."createdAt" - p."createdAt") / 3600))::numeric(10,1) AS p90_heures
FROM "Vote" v JOIN "Poll" p ON p.id = v."pollId";
```

### B4. Que répondent les votants ?

```sql
SELECT p.type, vc.choice, count(*) AS choix
FROM "VoteChoice" vc
JOIN "Vote" v ON v.id = vc."voteId"
JOIN "Poll" p ON p.id = v."pollId"
GROUP BY 1, 2 ORDER BY 1, 2;
```

## C. Sondages avec liste d'attente

### C1. Les créneaux se remplissent-ils ? Les listes d'attente servent-elles ?

État actuel des créneaux, pas leur historique.

```sql
SELECT count(*) AS creneaux,
       round(avg(cardinality(s.registered)::numeric / NULLIF(s."maxParticipants", 0)), 2) AS remplissage_moyen,
       count(*) FILTER (WHERE cardinality(s.registered) >= s."maxParticipants") AS complets,
       count(*) FILTER (WHERE cardinality(s."waitingList") > 0) AS avec_attente,
       round(avg(cardinality(s."waitingList")), 1) AS attente_moyenne,
       max(cardinality(s."waitingList")) AS attente_max,
       sum(cardinality(s."notComing")) AS reponses_non
FROM "Slot" s JOIN "Poll" p ON p.id = s."pollId"
WHERE p.type = 2;
```

### C2. Quelles options de création sont utilisées ?

```sql
SELECT count(*) AS sondages,
       round(avg(n), 1) AS creneaux_moyen, max(n) AS creneaux_max,
       count(*) FILTER (WHERE avec_description) AS avec_description,
       count(*) FILTER (WHERE avec_mot_de_passe) AS avec_mot_de_passe,
       count(*) FILTER (WHERE type = 2 AND delai = 2) AS ouverture_differee
FROM (SELECT p.id, p.type, p."timeBeforeAllowedType" AS delai,
             p.description <> '' AS avec_description,
             p.password <> '' AS avec_mot_de_passe,
             count(s.id) AS n
      FROM "Poll" p LEFT JOIN "Slot" s ON s."pollId" = p.id
      GROUP BY p.id) x;
```

## D. Notifications push

### D1. Quelle part des votants active les notifications ?

```sql
SELECT count(DISTINCT v.id) AS votes,
       count(DISTINCT sv."B") AS votes_avec_push,
       round(100.0 * count(DISTINCT sv."B") / NULLIF(count(DISTINCT v.id), 0), 1) AS pourcentage
FROM "Vote" v LEFT JOIN "_SubscriptionToVote" sv ON sv."B" = v.id;
```

### D2. Combien d'abonnements push sont créés chaque mois ?

```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mois, count(*) AS abonnements
FROM "Subscription" GROUP BY 1 ORDER BY 1;
```

## E. Commentaires

### E1. Les commentaires sont-ils utilisés ?

```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS mois,
       count(*) AS commentaires, count(DISTINCT "pollId") AS sondages
FROM "Comment" GROUP BY 1 ORDER BY 1;
```

## F. Santé

### F1. Le cron est-il à jour ?

Une échéance en retard de plus de 5 minutes veut dire que le conteneur du cron ne
tourne pas ou échoue.

```sql
SELECT count(*) FILTER (WHERE schedule < now() - interval '5 minutes') AS en_retard,
       count(*) FILTER (WHERE schedule >= now()) AS a_venir,
       min(schedule) FILTER (WHERE schedule >= now()) AS prochaine_echeance
FROM "CronSchedule";
```

## Limites connues

- Acquisition et parcours inconnus : on ne sait ni d'où viennent les organisateurs
  ni combien abandonnent la création ou le vote.
- Pas d'historique des listes d'attente : les promotions faites par le cron, les
  passages de « Oui » à « Non » et les envois push ne laissent pas de trace datée.
- Les sondages supprimés disparaissent des chiffres (suppression en cascade).
- Un organisateur sans e-mail n'est pas reconnu d'un sondage à l'autre ; deux
  organisateurs partageant une adresse comptent pour un.

## Évolution proposée (non implémentée)

Une table d'événements métier dans la base de KwikVote elle-même, lisible en SQL
par les agents comme le reste de ce document, sans outil externe :

- Modèle `Event` : `id`, `name` (nom stable), `pollId` (facultatif), `props` (JSON
  sans donnée personnelle), `createdAt`, avec un index sur (`name`, `createdAt`).
  L'ajout de cette table est le seul changement de schéma : il n'en modifie aucune autre.
- Écrits côté serveur dans les server actions et dans `cron.js` : `poll_created`,
  `poll_updated`, `slot_updated`, `slot_deleted`, `vote_created`, `vote_updated`,
  `vote_deleted` (avec priorité, place obtenue ou liste d'attente),
  `comment_created`, `push_subscribed`, `push_sent`, `push_failed`,
  `push_subscription_expired`, `waitlist_promoted`, `cron_run`, `action_failed`.
- Quelques étapes de parcours envoyées par le navigateur à une server action
  dédiée (liste fermée de noms, limitée en débit) : `create_form_opened`,
  `vote_dialog_opened`, `push_prompt_answered`.
- Conservation de 24 mois, purgée par le cron.

Chaque section de ce document gagnerait alors une requête sur `Event`.
