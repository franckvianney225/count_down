# Plan d'implémentation — Countdown v2

## État actuel (v1 → v2 migrée)
- [x] Timer unique global
- [x] Admin protégé par JWT (cookie httpOnly)
- [x] Synchronisation temps réel via WebSocket (NestJS + Socket.IO)
- [x] État persisté en PostgreSQL via Prisma
- [x] Rate limiting sur le login
- [x] Tests unitaires backend + frontend
- [x] Confirmation avant reset
- [x] Docker pour backend + BDD

---

## Fonctionnalités v2 à implémenter

### F1 — Séquences de phases
**Priorité : 1 — Impact maximum**

Remplacer le timer unique par un programme de phases enchaînées.

**Ce que ça change :**
- L'admin configure N phases (nom + durée en minutes)
- Le timer passe automatiquement à la phase suivante quand une phase se termine
- L'écran public affiche le nom de la phase en cours
- L'admin peut sauter à la phase suivante ou revenir en arrière

**Modèle de données (Prisma) :**
```prisma
model EventSession {
  id        Int     @id @default(autoincrement())
  name      String
  phases    Phase[]
  isActive  Boolean @default(false)
  currentPhaseIndex Int @default(0)
}

model Phase {
  id        Int     @id @default(autoincrement())
  name      String
  duration  Int     // en secondes
  order     Int
  session   EventSession @relation(fields: [sessionId], references: [id])
  sessionId Int
}
```

**API backend (NestJS) :**
- `POST /session` — créer une session avec ses phases
- `GET /session/current` — récupérer l'état courant
- `POST /session/next-phase` — passer à la phase suivante
- `POST /session/prev-phase` — revenir à la phase précédente

**Événements WebSocket :**
- `session_state` — état complet (phase courante, temps restant, liste des phases)

**Frontend :**
- Page admin : formulaire pour ajouter/réordonner/supprimer des phases (drag & drop)
- Affichage public : nom de la phase en haut, timer au centre, mini-liste des phases à venir en bas

**Statut :** [x] Terminé

---

### F2 — Messages flash admin → écran
**Priorité : 2 — Résout un problème concret de terrain**

L'admin envoie un message texte depuis le dashboard, il s'affiche en surimpression sur l'écran public pendant N secondes.

**Ce que ça change :**
- Champ texte + bouton "Envoyer" dans le dashboard admin
- Message affiché en overlay semi-transparent sur l'écran public
- Durée d'affichage configurable (5s, 10s, 30s, permanent)
- Bouton pour effacer le message en cours

**API backend :**
- `POST /timer/message` — émettre un message via WebSocket (pas de persistance nécessaire)

**Événements WebSocket :**
- `flash_message` — `{ text: string, duration: number }` (0 = permanent)

**Frontend :**
- Overlay animé (slide depuis le haut ou le bas)
- Auto-disparition après la durée configurée

**Statut :** [ ] À faire

---

### F3 — Décompte overtime (timer négatif)
**Priorité : 3 — Feedback immédiat et universel**

Quand le timer atteint 0, il continue en négatif en rouge avec signe `-`.

**Ce que ça change :**
- Le timer ne s'arrête plus à 0
- Il continue : `-00:01`, `-00:02`…
- L'affichage passe en rouge vif (fond ou texte)
- L'admin voit aussi le dépassement dans son dashboard
- Le reset remet à la durée initiale

**Backend :**
- `getState()` retourne `remainingSeconds` pouvant être négatif
- `isActive` reste `true` même en overtime

**Frontend :**
- Si `remainingSeconds < 0` : afficher `- MM:SS` en rouge
- Fond de l'écran public passe au rouge sombre

**Statut :** [ ] À faire

---

### F4 — Temps de parole par intervenant
**Priorité : 4 — Différenciant pour les débats**

Chaque paneliste a un budget de temps. L'admin clique sur son nom pour démarrer son chronomètre individuel.

**Ce que ça change :**
- L'admin configure une liste de panelistes (nom, budget temps)
- Un seul paneliste est "actif" à la fois
- L'écran public affiche : nom de la personne active + son temps restant
- Le temps global de la session tourne en parallèle

**Modèle de données :**
```prisma
model Panelist {
  id              Int     @id @default(autoincrement())
  name            String
  totalSeconds    Int     // budget initial
  usedSeconds     Int     @default(0)
  isActive        Boolean @default(false)
  sessionId       Int?
}
```

**API backend :**
- `POST /panelists` — ajouter un paneliste
- `POST /panelists/:id/activate` — démarrer son chronomètre
- `POST /panelists/stop` — stopper le chronomètre actif

**Événements WebSocket :**
- `panelist_update` — état de tous les panelistes

**Frontend :**
- Dashboard admin : liste des panelistes, clic pour activer
- Écran public : bandeau en bas avec nom + budget restant du paneliste actif

**Statut :** [ ] À faire

---

### F5 — Templates d'événements sauvegardés
**Priorité : 5 — Gain de temps pour les prochaines éditions**

L'admin sauvegarde une configuration complète et peut la recharger en un clic.

**Ce que ça change :**
- Bouton "Sauvegarder comme template" dans le dashboard
- Liste des templates (nom, nombre de phases, durée totale)
- Bouton "Charger" pour appliquer un template à la session courante
- Bouton "Supprimer"

**Modèle de données :**
```prisma
model EventTemplate {
  id        Int             @id @default(autoincrement())
  name      String
  createdAt DateTime        @default(now())
  phases    TemplatePhase[]
}

model TemplatePhase {
  id         Int           @id @default(autoincrement())
  name       String
  duration   Int           // en secondes
  order      Int
  templateId Int
  template   EventTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
}
```

**API backend :**
- `GET /templates` — liste des templates
- `POST /templates` — créer depuis la session courante
- `POST /templates/:id/load` — charger un template dans la session courante
- `DELETE /templates/:id` — supprimer

**Frontend :**
- Section "Templates" dans le dashboard admin
- Formulaire de nommage avant sauvegarde

**Statut :** [ ] À faire

---

## Améliorations écran public — v3

### P1 — Horloge courante
Afficher l'heure réelle (HH:MM) en coin de l'écran public, utile pour la salle et les organisateurs.

- Coin haut-droit ou bas-droit, discret
- Mis à jour chaque seconde côté client (pas de backend nécessaire)

**Statut :** [ ] À faire

---

### P2 — Barres de progression
Deux indicateurs visuels de l'avancement :
- **Barre de phase** : progression de la phase courante (temps écoulé / durée totale)
- **Barre globale** : progression de la session (phase N sur total)

- Couleur qui évolue selon le temps restant (vert → orange → rouge)
- Pas de nouveau modèle DB (calculé depuis `session_state`)

**Statut :** [ ] À faire

---

### P3 — Branding / nom de l'événement
Afficher le nom de la session en haut de l'écran public, configurable depuis l'admin.

- Déjà partiellement en place (`sessionName` dans `session_state`)
- Amélioration : style plus visible, police grande, possibilité d'ajouter un sous-titre

**Statut :** [ ] À faire

---

### P4 — Animation de changement de phase
Quand l'admin passe à la phase suivante, l'écran public affiche une transition visuelle.

- Fondu enchaîné entre l'ancien et le nouveau nom de phase
- Ou : compte à rebours "3… 2… 1…" avant l'affichage de la nouvelle phase
- Durée de transition : ~1.5 s

**Statut :** [ ] À faire

---

### P5 — Bandeau intervenant amélioré
Le bandeau actuel est petit en bas. Quand un intervenant est activé :

- Animation d'entrée plus visible (slide depuis le bas)
- Nom en grand avec style "C'est maintenant à [Nom] de parler"
- Barre de progression du budget individuel intégrée dans le bandeau
- Changement de couleur progressif (vert → orange → rouge) selon budget restant

**Statut :** [ ] À faire

---

### P6 — Mode salle d'attente
Avant que la session démarre (`isActive = false`, `sessionId != null`), afficher un écran d'attente avec l'agenda à venir.

- Liste des phases avec durées
- Message "La session commence bientôt"
- Horloge courante bien visible

**Statut :** [ ] À faire

---

### P7 — Mode minimaliste (projecteur)
URL `/display?mode=minimal` — écran épuré pour grands écrans et projecteurs.

- Fond noir uni
- Juste le timer en très grand (police max)
- Nom de phase en petit en dessous
- Aucune décoration (pas de vagues, pas de phases à venir)

**Statut :** [ ] À faire

---

### P8 — Mode OBS/overlay (streaming)
URL `/overlay` — fond transparent pour incrustation dans OBS ou StreamLabs.

- `background: transparent` via CSS global sur cette route
- Affiche uniquement le timer + nom de phase
- Idéal pour les retransmissions vidéo

**Statut :** [ ] À faire

---

### P9 — Alertes sonores
Sons configurables déclenchés à des seuils de temps.

- Seuils : 5 min, 1 min, 0 (fin de phase)
- Sons distincts pour chaque seuil
- Configurable depuis l'admin (activer/désactiver)
- Joué côté client (Web Audio API ou fichiers audio)
- Pas de backend nécessaire

**Statut :** [ ] À faire

---

## Fonctionnalités v2.5 (post-lancement)

| Feature | Description |
|---|---|
| Multi-room | Plusieurs panels en parallèle, un dashboard par salle |
| Démarrage automatique | Timer démarre à une heure précise configurée |

---

## Ordre d'implémentation suggéré

```
Semaine 1 : F3 (overtime)       ← rapide, pas de nouveau modèle DB
Semaine 1 : F2 (messages flash) ← rapide, juste WebSocket
Semaine 2 : F1 (séquences)      ← gros morceau, refonte du modèle DB
Semaine 3 : F4 (intervenants)   ← nouveau modèle DB, UI complexe
Semaine 4 : F5 (templates)      ← dépend de F1
```

---

## Architecture des changements techniques

### Nouvelles migrations Prisma
```bash
cd backend
npx prisma migrate dev --name add_phases_panelists_templates
```

### Nouveaux modules NestJS
```
src/
├── session/        ← F1 : gestion des phases
├── panelist/       ← F4 : intervenants
└── template/       ← F5 : templates
```

### Nouvelles pages Next.js
```
src/app/
├── admin/
│   ├── session/page.tsx      ← F1 : config des phases
│   ├── panelists/page.tsx    ← F4 : gestion des intervenants
│   └── templates/page.tsx   ← F5 : templates
```

---

## Suivi

| Feature | DB | Backend | Frontend | Tests | Statut |
|---|---|---|---|---|---|
| F3 — Overtime | — | [x] | [x] | [x] | Terminé |
| F2 — Messages flash | — | [x] | [x] | [x] | Terminé |
| F1 — Séquences | [x] | [x] | [x] | [ ] | Terminé |
| F4 — Intervenants | [x] | [x] | [x] | [ ] | Terminé |
| F5 — Templates | [x] | [x] | [x] | [ ] | Terminé |
| P1 — Horloge courante | — | — | [ ] | — | À faire |
| P2 — Barres de progression | — | — | [ ] | — | À faire |
| P3 — Branding événement | — | — | [ ] | — | À faire |
| P4 — Animation changement phase | — | — | [ ] | — | À faire |
| P5 — Bandeau intervenant amélioré | — | — | [ ] | — | À faire |
| P6 — Mode salle d'attente | — | — | [ ] | — | À faire |
| P7 — Mode minimaliste | — | — | [ ] | — | À faire |
| P8 — Mode OBS/overlay | — | — | [ ] | — | À faire |
| P9 — Alertes sonores | — | — | [ ] | — | À faire |
