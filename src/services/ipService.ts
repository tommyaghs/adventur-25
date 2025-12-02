/**
 * Servizio per gestire la limitazione IP e i tentativi giornalieri
 */

interface AttemptRecord {
  ip: string;
  date: string; // formato YYYY-MM-DD
  day: number;
  timestamp: number;
}

/**
 * Ottiene l'indirizzo IP dell'utente usando un servizio esterno
 */
export async function getUserIP(): Promise<string> {
  try {
    // Prova prima con ipify (gratuito, senza rate limit per uso normale)
    const response = await fetch('https://api.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.warn('Errore nel recupero IP da ipify:', error);
  }

  // Fallback: usa un servizio alternativo
  try {
    const response = await fetch('https://api64.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.warn('Errore nel recupero IP da api64:', error);
  }

  // Se tutto fallisce, genera un ID univoco basato su browser fingerprint
  return generateFallbackId();
}

/**
 * Genera un ID fallback basato su caratteristiche del browser
 */
function generateFallbackId(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // Crea un hash semplice
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `fallback-${Math.abs(hash)}`;
}

/**
 * Ottiene la data corrente in formato YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Verifica se l'IP ha già fatto un tentativo oggi
 * Usa localStorage come cache locale + GitHub Gists come backend
 */
export async function hasAttemptedToday(ip: string, day: number): Promise<boolean> {
  const today = getTodayDateString();
  const cacheKey = `attempt_${ip}_${today}_${day}`;
  
  // Controlla prima la cache locale
  const cached = localStorage.getItem(cacheKey);
  if (cached === 'true') {
    return true;
  }

  // Verifica sul backend GitHub (se configurato)
  try {
    const hasAttempted = await checkGitHubBackend(ip, today, day);
    if (hasAttempted) {
      localStorage.setItem(cacheKey, 'true');
      return true;
    }
  } catch (error) {
    console.warn('Errore nel controllo backend GitHub, uso solo cache locale:', error);
  }

  return false;
}

/**
 * Registra un tentativo per l'IP corrente
 */
export async function recordAttempt(ip: string, day: number): Promise<void> {
  const today = getTodayDateString();
  const cacheKey = `attempt_${ip}_${today}_${day}`;
  
  // Salva in cache locale
  localStorage.setItem(cacheKey, 'true');
  
  // Salva anche un record completo
  const attempt: AttemptRecord = {
    ip,
    date: today,
    day,
    timestamp: Date.now()
  };
  
  const attemptsKey = `all_attempts_${today}`;
  const existingAttempts = localStorage.getItem(attemptsKey);
  let attempts: AttemptRecord[] = existingAttempts ? JSON.parse(existingAttempts) : [];
  attempts.push(attempt);
  localStorage.setItem(attemptsKey, JSON.stringify(attempts));

  // Prova a salvare su GitHub backend (se configurato)
  try {
    await saveToGitHubBackend(attempt);
  } catch (error) {
    console.warn('Errore nel salvataggio su GitHub backend:', error);
    // Non blocchiamo l'utente se il backend fallisce
  }
}

/**
 * Controlla sul backend GitHub se l'IP ha già tentato oggi
 * Usa GitHub Gists API per salvare i tentativi
 */
async function checkGitHubBackend(ip: string, date: string, day: number): Promise<boolean> {
  const gistId = localStorage.getItem('github_gist_id');
  if (!gistId) {
    return false; // Nessun backend configurato
  }

  try {
    // Leggi il gist (pubblico, non serve autenticazione per leggere)
    const response = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!response.ok) {
      return false;
    }

    const gist = await response.json();
    const filename = `attempts_${date}.json`;
    const file = gist.files[filename];
    
    if (!file) {
      return false;
    }

    const attempts: AttemptRecord[] = JSON.parse(file.content);
    return attempts.some(attempt => attempt.ip === ip && attempt.day === day);
  } catch (error) {
    console.error('Errore nel controllo GitHub backend:', error);
    return false;
  }
}

/**
 * Salva un tentativo sul backend GitHub
 * Richiede un GitHub Personal Access Token configurato
 */
async function saveToGitHubBackend(attempt: AttemptRecord): Promise<void> {
  const gistId = localStorage.getItem('github_gist_id');
  const githubToken = import.meta.env.VITE_GITHUB_TOKEN;
  
  if (!gistId || !githubToken) {
    // Backend non configurato, usa solo localStorage
    return;
  }

  try {
    // Leggi il gist esistente
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error('Errore nel recupero del gist');
    }

    const gist = await response.json();
    const filename = `attempts_${attempt.date}.json`;
    const existingFile = gist.files[filename];
    
    let attempts: AttemptRecord[] = existingFile 
      ? JSON.parse(existingFile.content)
      : [];
    
    // Aggiungi il nuovo tentativo solo se non esiste già
    const exists = attempts.some(a => a.ip === attempt.ip && a.day === attempt.day);
    if (!exists) {
      attempts.push(attempt);
    }

    // Aggiorna il gist
    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [filename]: {
            content: JSON.stringify(attempts, null, 2)
          }
        }
      })
    });
  } catch (error) {
    console.error('Errore nel salvataggio su GitHub backend:', error);
    throw error;
  }
}

/**
 * Inizializza il backend GitHub creando un nuovo Gist
 * Richiede un GitHub Personal Access Token
 */
export async function initializeGitHubBackend(githubToken: string): Promise<string> {
  try {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Advent Calendar Attempts Tracker',
        public: false, // Gist privato
        files: {
          'README.md': {
            content: '# Advent Calendar Attempts Tracker\n\nQuesto Gist traccia i tentativi giornalieri per IP.'
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Errore nella creazione del Gist');
    }

    const gist = await response.json();
    localStorage.setItem('github_gist_id', gist.id);
    return gist.id;
  } catch (error) {
    console.error('Errore nell\'inizializzazione del backend GitHub:', error);
    throw error;
  }
}

