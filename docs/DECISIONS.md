# Décisions de KwikVote

Les décisions produit et techniques qui engagent le projet, les plus récentes en
haut. Chaque décision dit ce qui a été décidé, pourquoi, et ce qui en découle.
Une décision ne se change qu'avec l'accord de la propriétaire, par une nouvelle
entrée qui remplace l'ancienne.

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
- Le plan exact de la pile de PR #10 à #33 sera ajouté ici quand il sera validé.

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
