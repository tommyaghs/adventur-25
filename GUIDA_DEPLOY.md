# 🚀 Guida Passo-Passo: Deploy su GitHub Pages

## 📋 Prerequisiti

- Account GitHub
- Git installato sul computer
- Node.js e npm installati

---

## STEP 1: Inizializza Git nel progetto

Apri il terminale nella cartella `adventure-25` ed esegui:

```bash
git init
git add .
git commit -m "Initial commit: Advent Calendar con limitazione IP"
```

---

## STEP 2: Crea il Repository su GitHub

1. Vai su https://github.com/new
2. **Repository name**: Scegli un nome (es. `advent-calendar-2025` o `adventure-25`)
   - ⚠️ **IMPORTANTE**: Ricorda questo nome, ti servirà dopo!
3. **Description**: (opzionale) "Calendario dell'Avvento 2025"
4. Scegli **Private** o **Public** (come preferisci)
5. **NON** spuntare "Add a README file" (abbiamo già il README)
6. Clicca **"Create repository"**

---

## STEP 3: Configura il Base Path

Devi modificare `vite.config.ts` con il nome del tuo repository.

**Apri** `vite.config.ts` e alla riga 14, sostituisci `'adventure-25'` con il nome del repository che hai scelto:

```typescript
// PRIMA (esempio):
base: process.env.NODE_ENV === 'production' ? '/adventure-25/' : '/',

// DOPO (se il tuo repo si chiama "advent-calendar-2025"):
base: process.env.NODE_ENV === 'production' ? '/advent-calendar-2025/' : '/',
```

**⚠️ IMPORTANTE**: Il nome deve corrispondere ESATTAMENTE al nome del repository GitHub!

---

## STEP 4: Collega il Repository Locale a GitHub

GitHub ti mostrerà delle istruzioni. Esegui questi comandi (sostituisci `TUO_USERNAME` e `NOME_REPO`):

```bash
git remote add origin https://github.com/TUO_USERNAME/NOME_REPO.git
git branch -M main
git push -u origin main
```

**Esempio**:
```bash
git remote add origin https://github.com/thomas/advent-calendar-2025.git
git branch -M main
git push -u origin main
```

---

## STEP 5: Abilita GitHub Pages

1. Vai sul tuo repository su GitHub
2. Clicca su **Settings** (in alto a destra)
3. Scorri fino a **Pages** (menu laterale sinistro)
4. In **Source**, seleziona **"GitHub Actions"**
5. Clicca **Save**

---

## STEP 6: Verifica il Deploy

1. Vai su **Actions** (tab in alto)
2. Dovresti vedere un workflow "Deploy to GitHub Pages" in esecuzione
3. Attendi che finisca (circa 2-3 minuti)
4. Quando vedi un ✅ verde, il deploy è completato!

5. Vai su **Settings** → **Pages**
6. Troverai l'URL del tuo sito (es. `https://TUO_USERNAME.github.io/NOME_REPO/`)

---

## STEP 7: Configura il Backend GitHub (OPZIONALE)

Il sistema funziona anche senza backend, ma se vuoi sincronizzare i tentativi:

### 7.1 Crea un GitHub Personal Access Token

1. Vai su https://github.com/settings/tokens
2. Clicca **"Generate new token"** → **"Generate new token (classic)"**
3. **Note**: "Advent Calendar Backend"
4. **Expiration**: Scegli una durata (es. 90 giorni)
5. **Scopes**: Seleziona SOLO `gist` ✅
6. Clicca **"Generate token"**
7. **COPIA IL TOKEN** (lo vedrai solo una volta!)

### 7.2 Aggiungi il Token come Secret

1. Nel tuo repository: **Settings** → **Secrets and variables** → **Actions**
2. Clicca **"New repository secret"**
3. **Name**: `VITE_GITHUB_TOKEN`
4. **Secret**: Incolla il token che hai copiato
5. Clicca **"Add secret"**

### 7.3 Per Sviluppo Locale (Opzionale)

Crea un file `.env` nella cartella `adventure-25`:

```
VITE_GITHUB_TOKEN=il_tuo_token_qui
```

⚠️ **NON committare questo file!** (è già in .gitignore)

---

## ✅ Verifica Finale

1. Vai all'URL del tuo sito GitHub Pages
2. Prova ad aprire una casella del calendario
3. Controlla la console del browser (F12) per eventuali errori

---

## 🐛 Problemi Comuni

### Il sito non si carica / 404
- Verifica che il base path in `vite.config.ts` corrisponda ESATTAMENTE al nome del repository
- Controlla che GitHub Pages sia abilitato con "GitHub Actions" come source

### Il deploy fallisce
- Vai su **Actions** → controlla gli errori nel workflow
- Verifica che tutti i file siano stati committati

### Il backend GitHub non funziona
- Verifica che il token abbia lo scope `gist`
- Controlla che il secret `VITE_GITHUB_TOKEN` sia configurato
- Il sistema funziona comunque senza backend usando localStorage

---

## 📝 Note

- Il deploy avviene automaticamente ad ogni push su `main`
- Il sito sarà disponibile su `https://TUO_USERNAME.github.io/NOME_REPO/`
- La limitazione IP funziona anche senza backend GitHub

