# Calendario dell'Avvento 2025 🎄

Un calendario dell'Avvento interattivo con sistema di gratta e vinci, limitazione IP per prevenire tentativi multipli, e deploy serverless su GitHub Pages.

## ✨ Caratteristiche

- 🎁 **Calendario Interattivo**: Apri una casella al giorno durante il periodo natalizio
- 🎯 **Sistema Gratta e Vinci**: Gratta la superficie per scoprire se hai vinto
- 🔒 **Limitazione IP**: Un solo tentativo al giorno per indirizzo IP
- 📦 **Serverless**: Deploy automatico su GitHub Pages
- 💾 **Backend GitHub**: Usa GitHub Gists API come backend per tracciare i tentativi

## 🚀 Deploy su GitHub Pages

### Prerequisiti

1. Un repository GitHub
2. Un GitHub Personal Access Token (per il backend opzionale)

### Passi per il Deploy

1. **Configura il base path in `vite.config.ts`**:
   - Sostituisci `'/adventure-25/'` con il nome del tuo repository
   - Se il repository si chiama `my-advent-calendar`, usa `'/my-advent-calendar/'`

2. **Abilita GitHub Pages**:
   - Vai su Settings → Pages nel tuo repository
   - Scegli "GitHub Actions" come source

3. **Configura il Backend GitHub (Opzionale)**:
   - Crea un [GitHub Personal Access Token](https://github.com/settings/tokens) con permessi `gist`
   - Aggiungi il token come secret nel repository: Settings → Secrets and variables → Actions
   - Aggiungi un secret chiamato `VITE_GITHUB_TOKEN` con il valore del tuo token
   - **Nota**: Il token sarà visibile nel codice client-side, quindi usa un token con permessi limitati solo ai Gists

4. **Push del codice**:
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deploy"
   git push origin main
   ```

5. **Il deploy avverrà automaticamente** tramite GitHub Actions

### Deploy Manuale

Se preferisci deploy manuale:

```bash
npm install
npm run build
# Poi carica manualmente la cartella dist/ su GitHub Pages
```

## 🔧 Configurazione Backend GitHub (Opzionale)

Il sistema funziona anche senza backend GitHub usando solo localStorage. Per abilitare il backend:

1. **Crea un GitHub Personal Access Token**:
   - Vai su https://github.com/settings/tokens
   - Crea un nuovo token con scope `gist`
   - Copia il token

2. **Aggiungi il token come variabile d'ambiente**:
   - Per sviluppo locale: crea un file `.env` con `VITE_GITHUB_TOKEN=your_token_here`
   - Per produzione: aggiungi come secret GitHub Actions (vedi sopra)

3. **Inizializza il backend** (opzionale, può essere fatto automaticamente):
   - Il sistema creerà automaticamente un Gist privato al primo utilizzo

## 📝 Limitazione IP

Il sistema limita ogni IP a **un solo tentativo al giorno** per ogni casella del calendario.

- Usa servizi esterni (ipify.org) per ottenere l'IP dell'utente
- Salva i tentativi in localStorage (cache locale)
- Opzionalmente sincronizza con GitHub Gists per persistenza cross-device
- In caso di errore nel recupero IP, usa un browser fingerprint come fallback

## 🛠️ Sviluppo Locale

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build

# Preview del build
npm run preview
```

## 📦 Tecnologie Utilizzate

- **React 19** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **jsPDF** - Generazione PDF certificati
- **QRCode** - Generazione codici QR
- **GitHub Pages** - Hosting serverless
- **GitHub Gists API** - Backend per tentativi

## 🔐 Sicurezza

⚠️ **Importante**: Se usi GitHub Gists come backend, il token sarà visibile nel codice client-side. 

- Usa un token con permessi **solo per i Gists**
- Non usare il tuo token personale principale
- Considera di creare un account GitHub dedicato per questo progetto
- Il Gist creato sarà privato per default

## 📄 Licenza

Questo progetto è privato e per uso personale.

## 🎯 Note

- La limitazione IP funziona principalmente lato client
- Per una sicurezza maggiore, considera l'uso di un backend server-side
- Il sistema funziona anche offline usando solo localStorage
- I tentativi vengono tracciati per data e giorno del calendario
