# Guida al Deploy su GitHub Pages

## 🚀 Setup Rapido

### 1. Configura il Base Path

Modifica `vite.config.ts` e sostituisci `'/adventure-25/'` con il nome del tuo repository:

```typescript
base: process.env.NODE_ENV === 'production' ? '/nome-del-tuo-repo/' : '/',
```

### 2. Abilita GitHub Pages

1. Vai su **Settings** → **Pages** nel tuo repository GitHub
2. Scegli **"GitHub Actions"** come source
3. Salva

### 3. Configura il Backend (Opzionale ma Consigliato)

Il sistema funziona anche senza backend usando solo localStorage, ma per una migliore tracciabilità:

1. **Crea un GitHub Personal Access Token**:
   - Vai su https://github.com/settings/tokens
   - Clicca "Generate new token (classic)"
   - Dai un nome (es. "Advent Calendar Backend")
   - Seleziona solo lo scope `gist`
   - Genera e copia il token

2. **Aggiungi il token come Secret**:
   - Nel repository: **Settings** → **Secrets and variables** → **Actions**
   - Clicca "New repository secret"
   - Nome: `VITE_GITHUB_TOKEN`
   - Valore: incolla il tuo token
   - Salva

3. **Per sviluppo locale** (opzionale):
   - Crea un file `.env` nella root del progetto
   - Aggiungi: `VITE_GITHUB_TOKEN=your_token_here`
   - **⚠️ Non committare questo file!** (è già in .gitignore)

### 4. Push e Deploy

```bash
git add .
git commit -m "Setup GitHub Pages"
git push origin main
```

Il deploy avverrà automaticamente tramite GitHub Actions. Puoi vedere lo stato in **Actions** → **Deploy to GitHub Pages**.

## 📝 Note Importanti

- ⚠️ **Sicurezza Token**: Il token GitHub sarà visibile nel codice client-side. Usa sempre un token con permessi limitati solo ai Gists.
- 🔒 **Gist Privato**: Il sistema crea automaticamente un Gist privato per tracciare i tentativi.
- 💾 **Fallback**: Se il backend GitHub non è configurato, il sistema usa solo localStorage (funziona offline).
- 🌐 **Limitazione IP**: Funziona principalmente lato client. Per sicurezza maggiore, considera un backend server-side.

## 🐛 Troubleshooting

### Il deploy non funziona
- Verifica che GitHub Pages sia abilitato con "GitHub Actions" come source
- Controlla gli errori in **Actions** → **Deploy to GitHub Pages**
- Verifica che il base path in `vite.config.ts` corrisponda al nome del repository

### Il backend GitHub non funziona
- Verifica che il token abbia lo scope `gist`
- Controlla che il secret `VITE_GITHUB_TOKEN` sia configurato correttamente
- Il sistema funziona comunque senza backend usando localStorage

### L'IP non viene rilevato
- Il sistema usa servizi esterni (ipify.org) per ottenere l'IP
- In caso di errore, usa un browser fingerprint come fallback
- La limitazione funziona comunque usando il fallback ID

