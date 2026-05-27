# SymbolGen — Roadmap & Stratégie

## Vision
SymbolGen est le seul outil de recherche de symboles Unicode et de génération LaTeX par langage naturel supportant le **français et l'anglais**. L'objectif est d'éliminer toute friction entre une idée et le symbole ou la formule correspondante, pour les étudiants, ingénieurs, développeurs et rédacteurs.

---

## État actuel (v1.0)

- [x] Popup de recherche symboles Unicode (langage naturel FR/EN)
- [x] Générateur LaTeX avec rendu visuel (CodeCogs)
- [x] Copier symbole / Copier LaTeX / Copier image formule
- [x] Favoris persistants
- [x] Persistance de la dernière recherche (symboles + formule)
- [x] Onglets Symboles / Formules
- [x] Dark mode
- [x] Options page (clé API Groq)

---

## v1.1 — Ergonomie de base (en cours)

**Objectif : réduire le workflow de 5 actions à 2**

- [x] **Insertion directe** : clic sur un symbole l'insère dans le champ texte actif de l'onglet courant (input, textarea, contenteditable — fonctionne sur Gmail, Notion, Google Docs, VSCode web…)
- [x] **Raccourci clavier global** : `Alt+S` ouvre le popup sans toucher la souris
- [x] **Welcome page** : page d'onboarding affichée à la première installation (3 étapes, lien clé Groq, CTA)

---

## v1.2 — Richesse fonctionnelle

**Priorité : rétention et utilité quotidienne**

- [ ] **Historique des 20 dernières recherches** — icône horloge dans le popup, clic pour relancer
- [ ] **Symboles récents** — affichés directement à l'ouverture si l'input est vide
- [ ] **Skeleton loader formules** — feedback visuel pendant le chargement de l'image CodeCogs
- [ ] **Copy SVG formule** — bouton "Copier en SVG" en plus du PNG
- [ ] **Retry automatique** si le parsing JSON échoue (1 retry avec prompt renforcé)
- [ ] **Nombre de résultats configurable** — slider 3–10 dans Options
- [ ] **Font fallback étendu** — `'Noto Sans Symbols', 'Segoe UI Symbol'` pour les symboles rares

---

## v1.3 — Personnalisation et fiabilité ✓

- [x] **Langue préférée** : FR / EN / Bilingue (dans Options, oriente le system prompt)
- [x] **Modèle Groq configurable** : `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` / `mixtral-8x7b`
- [x] **Raccourci clavier** : info + lien vers `chrome://extensions/shortcuts` dans Options
- [x] **Mode debug** : toggle pour afficher la réponse brute de l'IA en cas d'erreur de parsing
- [x] **Tooltip Unicode** : hover sur le symbole → nom complet + codepoint (attribut `title` natif)
- [x] **Insérer LaTeX** : bouton "Insérer" dans l'onglet Formules (content script, fonctionne sur Overleaf)

---

## v2.0 — Monétisation (Freemium) ✓

**Objectif : première revenue**

### Tier Gratuit (forever)
- [x] Symboles Unicode : 5 recherches/jour
- [x] Formules LaTeX : 3 formules/jour
- [x] Favoris : 10 max

### Tier Pro (4,99 €/mois ou 29,99 €/an)
- [x] Recherches illimitées
- [x] Favoris illimités
- [x] Historique étendu
- [x] Résultats élargis
- [ ] Export JSON/CSV des favoris
- [ ] Modèle IA premium

### Implémenté en v2.0
- [x] Compteurs d'usage dans `chrome.storage.local` (reset quotidien automatique)
- [x] Gate UI sur les features premium (upgrade bar)
- [x] Clé de licence Pro `SYMG-XXXX-XXXX-XXXX` (activation dans Options)
- [x] Badge "Pro" dans le header du popup

### Infrastructure future (v2.1+)
- [ ] Backend léger (Cloudflare Workers ou Railway) pour valider les licences
- [ ] Intégration Stripe/Paddle via ExtensionPay

---

## Stratégie d'acquisition

### Canal 1 — Chrome Web Store ASO (priorité max)

Le titre est le facteur de ranking #1 dans le CWS.

**Titre optimisé :**
> `SymbolGen — Symboles Unicode & Formules LaTeX par IA`

**Description (132 premiers caractères visibles dans les résultats) :**
> Trouvez instantanément n'importe quel symbole Unicode ou générez des formules LaTeX en langage naturel. Français et anglais. Gratuit.

**Mots-clés cibles :**
`unicode symbol`, `symbole unicode`, `latex formula`, `math symbols`, `special characters`, `formule mathématique`, `symbole mathématique`, `copy symbol`

**Actions :**
- 5 screenshots HD montrant des cas d'usage réels (pas juste l'UI)
- Catégorie : Productivity
- Mise à jour régulière = boost de ranking

---

### Canal 2 — Product Hunt

- Préparer 2–3 semaines avant : créer un compte PH, interagir avec la communauté
- Lancer un mardi ou mercredi (moins de compétition que lundi)
- Tagline : *"Describe any symbol in French or English, get the Unicode instantly"*
- GIF de démo 15 secondes : "environ égal → ≈" et "y égal 2x² → formule rendue"
- Mobiliser réseau dans les 2 premières heures

**Objectif :** 300–1 000 installs en 24h

---

### Canal 3 — Reddit (organique, durable)

| Subreddit | Angle |
|---|---|
| r/learnmath | "Extension pour générer des formules LaTeX par langage naturel" |
| r/LaTeX | Post technique sur l'approche Groq + CodeCogs |
| r/france + r/français | Seul outil de ce type en français |
| r/chrome | Post de lancement direct |
| r/SideProject | Partage de projet indie |
| r/webdev | Aspect technique MV3 + content script |

**Règle** : apporter de la valeur d'abord, pas de pub directe.

---

### Canal 4 — Communautés francophones (avantage concurrentiel unique)

Aucun concurrent ne cible les francophones :

- Discord : serveurs LaTeX FR, mathématiques, prépa, grandes écoles
- Forums : Zeste de Savoir, Developpez.com, OpenClassrooms
- YouTube : créateurs de tutos maths/LaTeX FR
- Twitter/X : `#LaTeX #maths #mathsFR #BTS #CPGE`
- TikTok : démo 30 secondes "astuce étudiants en maths"

---

### Canal 5 — Viral loop

**Option A — Partage de formules**
Bouton "Partager" → URL `symbolgen.app/formula?latex=...` → page web avec rendu + CTA "Installer l'extension"

**Option B — Watermark opt-in**
Version de l'image avec petit logo SymbolGen (opt-in, désactivable en Pro).
Les formules circulent dans Notion, Discord, notes → trafic gratuit.

---

### Canal 6 — Hacker News Show HN

Post : `Show HN: I built a Chrome extension to find Unicode symbols by natural language (FR/EN)`

- Poster entre 9h–12h EST un jour de semaine
- **Objectif :** 300–1 000 visites qualifiées en 24h

---

### Canal 7 — Partenariats éducatifs

- Profs de maths/physique prépa → proposer comme outil pédagogique
- Blog Overleaf → article "outils LaTeX" (leur public = notre cible exacte)
- Associations étudiantes ingénieurs (BDE grandes écoles, associations LaTeX)

---

### Canal 8 — SEO web (long terme)

Landing page simple (GitHub Pages) avec articles ciblés :

| Article | Volume estimé |
|---|---|
| "Comment taper le symbole ≈ sur clavier ?" | ~2 000 req/mois |
| "Comment écrire une intégrale en LaTeX ?" | ~5 000 req/mois |
| "Symboles mathématiques Unicode liste complète" | ~8 000 req/mois |
| "Générateur de formules LaTeX gratuit" | ~3 000 req/mois |

Chaque article → CTA vers l'extension. Trafic passif après 3–6 mois.

---

### Priorités par effort/impact

| Action | Effort | Impact | Délai résultats |
|---|---|---|---|
| ASO Chrome Web Store | Faible | Élevé | 2–4 semaines |
| Posts Reddit | Faible | Moyen | Immédiat |
| Product Hunt | Moyen | Très élevé | J+0 (1 semaine prep) |
| Communautés FR | Faible | Élevé | Immédiat |
| Show HN | Faible | Élevé | Immédiat |
| Viral loop | Élevé | Très élevé | v1.2 |
| SEO articles | Moyen | Élevé | 3–6 mois |
| Partenariats éduc. | Moyen | Élevé | 1–2 mois |

---

## Projections MRR (modèle freemium)

| Utilisateurs actifs | Taux conversion | MRR estimé |
|---|---|---|
| 1 000 | 1 % | ~50 €/mois |
| 5 000 | 1 % | ~250 €/mois |
| 15 000 | 1,5 % | ~1 125 €/mois |
| 50 000 | 2 % | ~5 000 €/mois |

**Scénario réaliste à 12 mois** (croissance organique) : 3 000–8 000 users → **75–400 €/mois**
**Scénario optimiste** (Product Hunt + communauté FR) : 15 000–30 000 users → **375–1 500 €/mois**

---

## Concurrence directe

| Extension | Points forts | Faille exploitable |
|---|---|---|
| SYMBL (50K users) | Grande base symboles | Pas de NLP, anglais uniquement |
| Special Characters (30K) | UI propre, bien noté | Recherche mots-clés anglais seulement |
| Symbol Finder (10K) | Rapide | Pas d'IA, très basique |
| LaTeX Math Equations (8K) | Équations visuelles | Pas de langage naturel |
| UniTex (5K) | Unicode + LaTeX | Peu maintenu |

**Différenciation SymbolGen** : seul outil combinant NLP français/anglais + symboles Unicode + générateur LaTeX avec rendu visuel.
