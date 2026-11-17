# Décisions de KwikVote

Les décisions produit et techniques qui engagent le projet, les plus récentes en
haut. Chaque décision dit ce qui a été décidé, pourquoi, et ce qui en découle.
Une décision ne se change qu'avec l'accord de la propriétaire, par une nouvelle
entrée qui remplace l'ancienne.

## 2026-11-17 : la pile de PR #10 à #33, réduite pour la maintenance

**Décision.** Les PR préparées du 14 au 15/11 sont triées selon la maintenance
seule (entrée ci-dessous) :

| PR                  | Contenu                                                                                                                                                                                                                                                             | Décision                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| #10 à #15 (vague 2) | Algorithme d'inscription partagé, vote prioritaire, création de sondage transactionnelle, suppression de créneau, choix en double et index unique, cron sur les règles de l'app (fin d'une cascade sans fin), échéance du premier créneau, abonnements push expirés | Gardées                                      |
| #16 à #24 (vague 3) | Tests unitaires, d'intégration et de bout en bout, accessibilité, moins de JavaScript, formulaire de vote rouvert sur le bon vote                                                                                                                                   | Gardées                                      |
| #25 à #29           | Outils de dev (failles critiques de vitest et tinypool), mises à jour mineures, zod 4 et la pile de validation, dates et identifiants, node-cron 4 et web-push 4                                                                                                    | Gardées                                      |
| #30, #31, #32       | React 19, Prisma 6, Next.js 16 et TypeScript 6                                                                                                                                                                                                                      | Reportées (brouillons marqués « [reporté] ») |
| #33                 | Tailwind CSS 4                                                                                                                                                                                                                                                      | Abandonnée, PR fermée et branche supprimée   |

**Pourquoi.**

- Les vagues 2 et 3 corrigent de vrais défauts de fiabilité pour l'organisateur
  actif, et ajoutent les tests qui protègent les mises à jour suivantes.
- Le vote prioritaire est déjà prêt et testé, et les correctifs de #13 et #14
  reposent sur lui : le retirer coûterait plus cher et serait plus risqué que le
  garder. Il répond aussi aux demandes de la roadmap publique.
- L'accessibilité et la performance (#17, #18, #19, #23) ne relèvent pas de la
  maintenance, mais elles sont déjà faites et testées, et toute la suite de la
  pile repose sur elles. Les retirer obligerait à réécrire une douzaine de PR.
- Les montées de version majeures sans bénéfice pour les utilisateurs attendent
  qu'un avis de sécurité ou la fin du support de React 18, Prisma 5 ou Next.js 15
  les impose. Tailwind 4 n'apporte rien aux utilisateurs ni à la sécurité.

**Conséquences.**

- Chaque vague est mise en ligne avec le même niveau de preuve que la vague 1b
  (PR #34) : sauvegarde vérifiée juste avant, CI verte, tests locaux, contrôle en
  lecture seule de la production après le déploiement, et feu vert explicite de
  la propriétaire.
- La vague 1b touche des fichiers que modifient aussi #11, #18, #21 et #27 : leurs
  conflits avec `main` sont résolus avant leur vague.
- Vague 2 : le script `docs/sql/vote-choice-unique-dry-run.sql` passe d'abord à
  blanc, en lecture seule, puis `vote-choice-unique.sql` juste avant le
  déploiement.
- La branche de #33 reste récupérable dans une archive git locale (commit
  `4ebc8b8`).

## 2026-11-17 : KwikVote passe en maintenance seule

**Décision.** KwikVote ne reçoit plus de nouvelle fonctionnalité lourde. Le
travail se limite à la sécurité, à la fiabilité et aux dépendances, pour les
organisateurs qui l'utilisent.

**Pourquoi.** Les chiffres de `docs/ANALYTICS.md` (requêtes A3 et A4, 17/11) :
un organisateur a créé 103 des 122 sondages, au rythme d'un par semaine, et il est
le seul actif sur les 90 derniers jours. Les 10 autres organisateurs n'ont créé
qu'un sondage chacun.

**Conséquences.**

- La sécurité et les sauvegardes passent en premier : chaque mise en ligne est
  précédée d'une sauvegarde vérifiée de la base.
- Les correctifs de fiabilité déjà écrits (inscriptions, cron, notifications push)
  et le vote prioritaire, déjà prêt et testé, restent prévus.
- Les mises à jour de dépendances restent prévues tant qu'elles corrigent des
  failles ou gardent des versions maintenues. Les montées de version sans bénéfice
  pour les utilisateurs sont reportées ou abandonnées.
- Le tri de la pile de PR #10 à #33 est dans l'entrée ci-dessus.

## 2026-11-17 : pas d'outil d'analytics supplémentaire

**Décision.** Ni PostHog, ni table d'événements dans la base. Le suivi repose
sur les requêtes SQL en lecture seule de `docs/ANALYTICS.md`, sur l'historique de
la base de production.

**Pourquoi.** KwikVote est en maintenance seule et l'usage tient à quelques
organisateurs : les données déjà en base répondent aux questions utiles.

**Conséquences.** L'acquisition et les parcours (abandon de la création, refus
du push) restent inconnus. Umami reste en place pour les pages vues.

## Rappel : tout le monde peut modifier un vote

**Décision** (antérieure au 17/11/2026). Sans compte utilisateur, n'importe quel
visiteur d'un sondage peut modifier ou supprimer n'importe quel vote. C'est voulu.
Ce n'est pas un bug à corriger. La branche qui limitait la modification au
navigateur qui avait créé le vote a été abandonnée le 17/11/2026.
