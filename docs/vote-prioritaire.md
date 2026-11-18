# Vote prioritaire

> Demande : « Ce serait que pour un vote on puisse désigner x vote comme prioritaire.
> Par exemple je m'inscris vendredi et samedi, du coup samedi je suis en liste
> d'attente. Ce serait bien de pouvoir dire que je veux en priorité samedi. Et du
> coup vendredi je passe en liste d'attente à la place. »

Ce document décrit d'abord le fonctionnement actuel (partie 1), puis la règle qui
produit la situation de l'exemple (partie 2), enfin la conception retenue et ses
alternatives (parties 3 et 4).

Les références `fichier:ligne` de la partie 1 et 2 pointent vers le code **avant**
la fonctionnalité, c'est-à-dire le commit `5c050c6` de `main`
(`git show 5c050c6:<fichier>` pour les relire).

---

## 1. Fonctionnement actuel

### 1.1 Modèle de données

`prisma/schema.prisma` :

- `Poll.type` (l. 21) : `1` = sondage libre (Oui / Non / Ne sais pas, pas de
  limite de places), `2` = « Sondage avec liste d'attente »
  (`components/poll/PollForm.tsx:103`). **Toute la logique d'inscription et de
  liste d'attente ne concerne que le type 2** (`lib/api/vote/mutation.ts:62`,
  `:167`, `:401` ; `lib/api/slot/mutation.ts:157`).
- `Poll.timeBeforeAllowedType` / `Poll.msBeforeAllowed` (l. 26-27) : l'heure
  d'ouverture des réinscriptions de chaque créneau, soit « la veille à 17h »
  (type 1), soit « N heures avant le début » (type 2, N en millisecondes).
- `Slot` (l. 35-48) porte quatre tableaux d'identifiants de votes, ordonnés
  (l'ordre est la file d'attente) :
  - `registered` : inscrits, au plus `maxParticipants` ;
  - `waitingList` : liste d'attente ;
  - `waitingListReregistered` : « liste d'attente réinscrits » ;
  - `notComing` : « ne viennent pas ».
- `Vote` (l. 50-59) : un nom, et un `VoteChoice` par créneau.
- `VoteChoice.choice` (l. 65) : `1` = Oui, `2` = Non, `3` = Ne sais pas
  (sondage libre uniquement, `lib/api/vote/mutation.ts:47`).
- `CronSchedule` (l. 10-17) : une date par créneau (sauf le premier) à laquelle
  le cron doit traiter les réinscrits de ce créneau.

Il n'y a pas de compte : un vote est identifié par son id (UUID généré côté
client, `components/poll/DialogVote.tsx:123`), retrouvé via le stockage local
(`lib/store/localVotesStore.ts`) ou les abonnements push.

### 1.2 Ordre des créneaux

Les créneaux sont toujours traités dans l'ordre chronologique, à date égale par
id : `lib/registration.ts:5-15` (`slotsOrderBy`, `compareSlots`), et la même
chose en dur dans `cron.js:82`.

### 1.3 Placement d'un vote (création / modification)

`createVote` (`lib/api/vote/mutation.ts:19-200`) :

1. prend le verrou du sondage (`withPollLock`, `prisma/db.ts:19-36` : transaction
   `ReadCommitted` + `pg_advisory_xact_lock(hashtext(pollId))`) ;
2. vérifie un choix par créneau et des valeurs valides (l. 33-49) ;
3. calcule, pour chaque créneau, si l'heure d'ouverture des réinscriptions est
   passée (`checkTimeBeforeAllow`, `lib/utils.ts:117-148`) ;
4. répare les ids de votes supprimés restés dans les tableaux
   (`repairDeletedVotes`, `lib/registration.ts:202-223`) ;
5. enregistre le vote (`upsert`, l. 95-165) ;
6. place le vote avec `updateSlotsArrayAfterCreation` (l. 202-368), puis écrit
   les quatre tableaux de chaque créneau (l. 180-185) ;
7. après la transaction, envoie une notification push « Vous êtes inscrit ! » à
   chaque vote **nouvellement** inscrit, sauf l'auteur du vote
   (`sendNotifications`, `lib/notifications.server.ts:21-118`).

`updateSlotsArrayAfterCreation` parcourt les créneaux **dans l'ordre
chronologique** avec un seul booléen `isRegisteredOnce` (l. 221) :

```ts
const isAllowedToRegister = () => !isRegisteredOnce || timePassed;   // l. 244
...
if (isChoiceNo) slot.notComing.push(voteId);                          // l. 331
else {
  if (!isFull() && isAllowedToRegister()) {                           // l. 334
    slot.registered.push(voteId);
    isRegisteredOnce = true;
  }
  else if (isAllowedToRegister()) slot.waitingList.push(voteId);      // l. 339
  else slot.waitingListReregistered.push(voteId);                     // l. 341
}
```

Autrement dit, pour un vote donné et un créneau où il a dit Oui :

| Situation                                                               | Tableau                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| pas encore inscrit sur un créneau **précédent**, place libre            | `registered`                                                          |
| pas encore inscrit sur un créneau précédent, complet                    | `waitingList` (à la fin)                                              |
| déjà inscrit sur un créneau précédent, heure d'ouverture **non passée** | `waitingListReregistered`, **même s'il reste de la place**            |
| déjà inscrit sur un créneau précédent, heure d'ouverture passée         | comme s'il n'était inscrit nulle part (`registered` ou `waitingList`) |

En modification (`voteExists`), un créneau dont le choix a changé est vidé de ce
vote puis traité comme une création (le vote perd sa place dans la file de ce
créneau, l. 256-262) ; sur un créneau inchangé, le vote garde sa place si son
tableau ne change pas (l. 263-328).

**Cascade** (l. 345-365) : tant qu'un créneau a de la place et une liste
d'attente non vide, le premier de cette liste (`waitingList[0]`) est replacé par
la même fonction, ce qui peut libérer une place ailleurs, etc. C'est ce qui fait
qu'une place libérée revient au premier de la liste d'attente, avec la
notification de l'étape 7.

Côté client, `DialogVote` (`components/poll/DialogVote.tsx:79-118`) n'appelle
que `updateVoteName` quand les choix n'ont pas changé (seul le nom change).

### 1.4 Suppression d'un vote

`deleteVote` (`lib/api/vote/mutation.ts:370-483`) retire le vote de tous les
tableaux, puis fait la même cascade (`updateSlotsArrayAfterDelete`, l. 485-612,
copie du cas « modification sans changement de choix » de la fonction
précédente), écrit les tableaux, notifie les nouveaux inscrits.

### 1.5 Ouverture des réinscriptions (cron)

- À la création d'un sondage de type 2, une `CronSchedule` est créée pour chaque
  créneau sauf le premier, à son heure d'ouverture
  (`lib/api/poll/mutation.ts:28-37`, `getCronSchedulesData`,
  `lib/registration.ts:227-268`).
- `cron.js` (processus séparé, `Dockerfile.cron`) tourne toutes les minutes
  (l. 460-472). Pour chaque sondage ayant une échéance passée (l. 23-193), sous
  le même verrou que l'application (l. 54-57) : si un créneau ouvert a de la
  place et des réinscrits, le premier réinscrit est replacé par
  `updateSlotsArray` (l. 195-336, même algorithme, cascade sur les réinscrits) ;
  sinon les réinscrits des créneaux ouverts passent **à la fin** de la liste
  d'attente (l. 129-140). Les nouveaux inscrits sont notifiés.
- `cron.js` a sa propre copie de `checkTimeBeforeAllow` (l. 338-363).

### 1.6 Modification et suppression de créneaux

- `updateSlotById` (`lib/api/slot/mutation.ts:118-245`) : si la date de début
  change, l'ordre des créneaux et leurs heures d'ouverture changent, donc
  `reconcileSlotsArrays` (`lib/registration.ts:92-198`) ré-applique les règles
  ci-dessus à tous les votes, et les `CronSchedule` sont recréées.
- `deleteSlotById` (`lib/api/slot/mutation.ts:26-116`) : cascade sur les
  réinscrits (`updateSlotsArray`, l. 247-427, encore une copie de l'algorithme).

### 1.7 Affichage

`components/poll/RegistrationPoll.tsx` affiche un tableau par créneau avec les
quatre listes (l. 58-76) : « Inscrits », « Liste d'attente », « Liste d'attente
réinscrits (inscrit à partir de la veille à 17h) », « Ne viennent pas ». Un clic
sur un nom ouvre `DialogVote` pour le modifier. L'aide
(`components/poll/RegistrationPollHelp.tsx`) explique : « Vous êtes déjà inscrit
à un jour précédent. Vous passez en inscrit ou en liste d'attente une fois que
l'heure limite choisie par l'auteur est atteinte. »

---

## 2. La règle qui produit la situation de l'exemple

Sondage de type 2, créneaux vendredi puis samedi, la personne répond Oui aux
deux, avant l'heure d'ouverture des réinscriptions du samedi (vendredi 17h par
défaut).

**Règle : avant l'heure d'ouverture d'un créneau, une personne ne peut être
inscrite (confirmée) que sur un seul créneau, et ce créneau est toujours le
premier dans l'ordre chronologique où elle a dit Oui et où il reste de la
place** (`lib/api/vote/mutation.ts:244` et `:334-341`).

Dans l'exemple :

1. vendredi a de la place → elle est inscrite vendredi, `isRegisteredOnce` passe
   à `true` ;
2. samedi : `isAllowedToRegister()` est faux (déjà inscrite avant, heure
   d'ouverture non passée) → elle va dans `waitingListReregistered`, affiché
   « Liste d'attente réinscrits », **que samedi soit complet ou non** ;
3. à vendredi 17h, le cron l'inscrit samedi s'il reste de la place, sinon la met
   à la fin de la liste d'attente du samedi, derrière les personnes qui n'étaient
   inscrites nulle part ailleurs.

Ce n'est donc ni l'ordre d'inscription ni le nombre de places du samedi qui la
met en attente, mais la règle « un seul créneau confirmé avant l'ouverture »
combinée à l'ordre **chronologique** des créneaux. Elle n'a aucun moyen de dire
que samedi compte plus pour elle que vendredi : répondre Non à vendredi est la
seule option, et elle perd alors toute chance d'y aller.

Cas voisin (vérifié aussi) : si vendredi est complet, elle est en liste
d'attente vendredi et inscrite samedi ; si une place se libère vendredi, la
cascade l'inscrit vendredi et la **retire** du samedi (réinscrits), la place du
samedi allant au premier de sa liste d'attente. Le créneau le plus tôt gagne
toujours.

Ces deux comportements ont été vérifiés en exécutant le code de `main` sur ces
scénarios (test de caractérisation), pas seulement en le lisant.

---

## 3. Conception retenue

### 3.1 Principe

La règle « un seul créneau confirmé avant l'ouverture » est **conservée**. Seul
change l'**ordre dans lequel les créneaux d'une personne sont considérés** :

> Les créneaux marqués prioritaires (où la personne a dit Oui) passent d'abord,
> dans l'ordre chronologique entre eux ; puis les autres, dans l'ordre
> chronologique.

Sans priorité, l'ordre est exactement l'ordre actuel : rien ne change pour les
votes existants. Marquer tous ses créneaux prioritaires revient à n'en marquer
aucun.

Tout le reste découle de l'algorithme existant, appliqué avec cet ordre
personnel : « inscrit sur un créneau précédent » devient « inscrit sur un
créneau qui passe avant dans **son** ordre ».

### 3.2 Exemple de la demande

Vendredi et samedi Oui, samedi prioritaire :

- **samedi a de la place** : elle est inscrite samedi immédiatement ; vendredi
  passe en « liste d'attente réinscrits » ; sa place du vendredi revient au
  premier de la liste d'attente du vendredi, qui reçoit la notification
  « Vous êtes inscrit ! » (cascade existante). C'est exactement « vendredi je
  passe en liste d'attente à la place ».
- **samedi est complet** : elle **garde** sa place du vendredi et passe à la
  **fin** de la liste d'attente du samedi. Dès qu'une place du samedi lui
  revient (dans l'ordre de la file), elle y est inscrite et notifiée, sa place
  du vendredi est libérée et va au premier de la liste d'attente du vendredi,
  lui aussi notifié.

### 3.3 Choix tranchés

**a. Types de sondage concernés.** Uniquement les sondages avec liste d'attente
(`Poll.type === 2`). Un sondage libre n'a ni places ni listes : la priorité n'y
aurait aucun effet, elle n'est pas proposée et le serveur l'enregistre toujours
à `false`.

**b. Combien de créneaux prioritaires (« x votes »).** Autant que l'on veut,
parmi ceux où l'on a dit Oui. La priorité n'a de sens qu'avec Oui : le serveur
la force à `false` sur un Non. Avec plusieurs créneaux prioritaires, la personne
est inscrite sur le premier d'entre eux (chronologiquement) qui a de la place ;
s'ils sont tous complets, elle attend sur chacun et peut être inscrite sur un
créneau non prioritaire en attendant.

_Alternatives écartées :_

- _un seul créneau prioritaire par vote_ : plus simple mais contredit « x votes »
  et oblige à choisir entre deux créneaux également préférés ;
- _un classement complet (1er choix, 2e choix…)_ : plus expressif, mais
  interface nettement plus lourde (ordonner des créneaux sur mobile) pour un
  gain faible ; le modèle booléen pourra évoluer vers un rang plus tard sans
  casser les données (`false` = rang par défaut).

**c. Créneau prioritaire complet, ou on y est déjà en attente.** La personne
**ne prend pas de place** à quelqu'un : elle rejoint la fin de la liste
d'attente de ce créneau (si elle était en « réinscrits », elle passe en « liste
d'attente », à la fin). Elle garde entre-temps la place qu'elle a ailleurs.
Quand une place se libère et que c'est son tour, la bascule est automatique.

_Alternatives écartées :_

- _refuser de marquer prioritaire un créneau complet_ : moins utile, et la
  personne devrait revenir surveiller les places ;
- _libérer tout de suite son autre place pour attendre_ : elle perdrait une place
  sûre sans rien gagner, et cela créerait des allers-retours de notifications ;
- _la placer en tête de la liste d'attente_ : passerait devant des personnes qui
  attendaient déjà (voir d.).

**d. Équité.** Une priorité ne fait jamais passer devant quelqu'un dans une liste
d'attente : la personne entre toujours **à la fin** de la liste d'attente du
créneau prioritaire. Elle ne peut prendre directement qu'une place **libre**.
Or une place libre avec une liste d'attente non vide n'existe pas (la cascade la
remplit aussitôt) : les seules personnes qu'elle « double » sont celles de la
liste des réinscrits, c'est-à-dire des personnes déjà inscrites sur un autre
créneau qui passe avant dans leur propre ordre. C'est déjà la règle actuelle : la
liste d'attente (personnes pour qui ce créneau est le premier choix possible)
passe avant les réinscrits (personnes déjà servies ailleurs). Marquer un créneau
prioritaire, c'est déclarer qu'il est son premier choix ; en contrepartie elle
**rend** sa place sur l'autre créneau, qui va au premier de la liste d'attente
de celui-ci. Personne ne peut détenir plus d'une place confirmée avant
l'ouverture, priorité ou non, et tout le monde dispose du même outil.

Corollaire : on ne peut pas « réserver » deux places en jouant avec la priorité.
Retirer la priorité ne rend la place du vendredi que s'il y en a une de libre,
sinon on passe à la fin de la liste d'attente du vendredi en gardant samedi.

**e. Modification et retrait d'une priorité.** Changer une priorité est une
modification du vote comme une autre (même action serveur `createVote`) : le
vote est replacé avec son nouvel ordre. Sur un créneau dont seul l'ordre change
(choix Oui/Non inchangé), la personne garde sa position si elle reste dans le
même tableau ; si elle change de tableau, elle arrive à la fin du nouveau, comme
aujourd'hui. Changer le choix Oui/Non d'un créneau garde le comportement actuel
(retirée de ce créneau puis replacée à la fin).

**f. Suppression d'un vote.** Inchangée : les `VoteChoice` (donc les priorités)
sont supprimés avec le vote, ses places vont aux premiers des listes d'attente,
qui sont notifiés.

**g. Heure d'ouverture et cron.** Inchangés dans leur principe : une fois l'heure
d'ouverture d'un créneau passée, la limite d'un seul créneau ne s'applique plus
à ce créneau, priorité ou non (un réinscrit peut y être inscrit en plus s'il
reste de la place). Les échéances dépendent des créneaux, pas des votes, mais
le premier créneau doit maintenant en avoir une aussi : avant la priorité, on ne
pouvait pas y être réinscrit, alors qu'une priorité sur un créneau suivant y
crée des réinscrits (`getCronSchedulesData` crée donc une `CronSchedule` pour
chaque créneau à venir). En revanche `cron.js` **doit**
utiliser le même ordre personnel : sans cela, à l'ouverture du vendredi (jeudi
17h), il inscrirait la personne vendredi puis, le samedi n'étant pas encore
ouvert, la retirerait du samedi, annulant sa priorité.

**h. Concurrence.** Toutes les écritures des tableaux (votes, créneaux, cron)
passent déjà par le même verrou consultatif par sondage dans une transaction
(`withPollLock` et sa copie dans `cron.js`). La bascule inscrit ↔ liste
d'attente et la cascade se font dans cette transaction : deux votes simultanés
sont sérialisés, le second voit ce que le premier a validé, et une erreur annule
tout. Les notifications partent après la validation.

**i. Modification des dates / suppression d'un créneau.** `reconcileSlotsArrays`
et la cascade de suppression de créneau utilisent le même ordre personnel.

**j. Compatibilité.** Nouveau champ `VoteChoice.priority Boolean @default(false)` :
changement purement additif, les votes existants valent `false` et gardent
exactement leur comportement. Un client resté sur l'ancienne version (onglet
ouvert pendant le déploiement) n'envoie pas `priority` : le serveur conserve
alors la priorité déjà enregistrée au lieu de l'effacer.

### 3.4 Interface

- **Formulaire de vote** (`DialogVote`, sondages avec liste d'attente) : sous le
  choix d'un créneau, quand la réponse est Oui, une case « Prioritaire » avec une
  étoile. Texte d'aide court au-dessus des créneaux : « Avant l'ouverture des
  réinscriptions, vous n'êtes inscrit que sur un créneau : le premier qui a de
  la place. Cochez « Prioritaire » sur vos créneaux préférés pour qu'ils
  passent en premier. » La case est reliée à ce texte (`aria-describedby`). La
  comparaison « rien n'a changé » tient compte de la priorité.
- **Résultats** (`RegistrationPoll`) : une étoile à côté du nom sur les créneaux
  marqués prioritaires (avec un texte pour les lecteurs d'écran et une
  infobulle), une ligne de légende, et l'aide (point d'interrogation) explique
  la priorité. On modifie sa priorité en cliquant sur son nom, comme pour le
  reste du vote. Le libellé « déjà inscrit à un jour précédent » devient « déjà
  inscrit sur un autre créneau ».

### 3.5 Implémentation

- L'algorithme de placement existait en quatre copies TypeScript quasi
  identiques (`updateSlotsArrayAfterCreation`, `updateSlotsArrayAfterDelete`,
  `updateSlotsArray` de `slot/mutation.ts`, plus `reconcileSlotsArrays`). Les
  trois premières sont regroupées en fonctions **pures** dans
  `lib/registration.ts` (`placeVote`, `registerVote`, `fillFreeSpots`,
  `registerAfterSlotDeletion`), qui reçoivent les choix de tous les votes au lieu
  de les relire un par un dans la transaction. L'ordre personnel est donné par
  `getSlotsInVoteOrder`. Les actions serveur ne font plus que lire, appeler ces
  fonctions et écrire, toujours sous `withPollLock`.
- Ces fonctions ont été comparées à l'ancien code de `main` (copié tel quel
  dans un harnais de test temporaire, non commité) sur 5 000 scénarios
  aléatoires de 25 opérations **sans priorité** (créations, modifications,
  suppressions de votes, suppressions de créneaux, changements d'ordre des
  créneaux) : résultats strictement identiques.
- `cron.js` reste autonome (son image Docker ne copie que `cron.js` et
  `prisma/`) : il reçoit sa propre copie de `getSlotsInVoteOrder` et lit
  `priority`. Il n'est plus lancé quand il est importé (pour les tests) ; lancé
  avec `node cron.js`, il fonctionne comme avant.
- Une boucle de cascade qui ne se termine pas (données incohérentes) lève une
  erreur et annule la transaction, au lieu de tourner jusqu'au délai de la
  transaction.

### 3.6 Tests

- `pnpm test` (Vitest, sans base) :
  - `lib/registration.test.ts` : l'exemple vendredi/samedi (avec et sans place
    le samedi), le retrait de la priorité, la suppression d'un vote, plusieurs
    priorités, « tout prioritaire = rien », la conservation des places dans les
    files, l'heure d'ouverture passée, la modification des dates et la
    suppression d'un créneau, et des invariants vérifiés sur 1 500 sondages
    aléatoires avec priorités (une seule place confirmée par personne avant
    l'ouverture, jamais de place libre avec une liste d'attente, chaque vote
    dans exactement un tableau par créneau, les créneaux qui précèdent la place
    d'une personne dans son ordre sont complets et elle y attend) ;
  - `cron.test.ts` : le cron à l'ouverture du vendredi garde le samedi
    prioritaire.
- `pnpm test:integration` (base PostgreSQL **locale** uniquement, refuse tout
  autre hôte) : `createVote` et `deleteVote` réels, notifications simulées, dont
  deux priorités simultanées pour la dernière place du samedi et 12 votes
  simultanés.
- Parcours de bout en bout dans un navigateur (Playwright, script hors dépôt)
  sur un serveur `next start` local branché sur une base Docker, et exécution
  réelle de `cron.js` sur cette base. Ce parcours a révélé un bug corrigé : à la
  modification d'un vote existant, la case « Prioritaire » n'apparaissait
  qu'après avoir changé le choix.

## 4. Points à valider avant déploiement

- Le déploiement lancera `prisma db push`, qui ajoutera la colonne
  `VoteChoice.priority` (additive, valeur par défaut `false`, vérifié sur une
  base locale contenant des données : aucune perte, aucune option
  `--accept-data-loss` nécessaire).
- **Redéployer le cron en même temps que l'application** (nouvelle image
  `Dockerfile.cron`) : un ancien cron ignorerait les priorités à l'heure
  d'ouverture et retirerait la personne de son créneau prioritaire ; un nouveau
  cron lancé avant le `db push` échouerait sur la colonne manquante (ses
  échéances seraient conservées et retraitées la minute suivante).
- **Sondages en cours créés avant ce correctif** : leur premier créneau n'a pas
  de `CronSchedule` (avant la priorité, on ne pouvait pas y être réinscrit).
  Une priorité posée après le déploiement sur un créneau suivant peut y créer
  un réinscrit que seul le cron d'un créneau suivant débloquera, parfois après
  le début du premier. Décider : insérer une fois les échéances manquantes
  (insertion seule, créneaux à venir des sondages de type 2), ou l'accepter.
- Valider les choix produit c. (attendre sur le créneau prioritaire complet sans
  perdre sa place) et d. (passer devant les réinscrits, jamais devant la liste
  d'attente).
- Valider les textes d'aide (formulaire, légende, fenêtre d'aide).
- Le refactor touche toute la logique d'inscription : il est prouvé équivalent
  sans priorité par le test différentiel, mais une relecture humaine de
  `lib/registration.ts` reste souhaitable.
