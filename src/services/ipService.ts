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
 * Ottiene il token GitHub dalla variabile d'ambiente
 */
function getGitHubToken(): string | null {
  return import.meta.env.VITE_GITHUB_TOKEN || null;
}

/**
 * Verifica se il backend GitHub è configurato e funzionante
 */
export function isBackendConfigured(): boolean {
  const gistId = localStorage.getItem('github_gist_id');
  const githubToken = getGitHubToken();
  return !!(gistId && githubToken);
}

/**
 * Verifica se l'IP ha già fatto un tentativo oggi
 * PRIORITÀ: Backend GitHub (fonte di verità) -> localStorage (solo cache)
 * IMPORTANTE: Il backend GitHub è OBBLIGATORIO per la sicurezza
 */
export async function hasAttemptedToday(ip: string, day: number): Promise<boolean> {
  const today = getTodayDateString();
  const cacheKey = `attempt_${ip}_${today}_${day}`;
  
  // PRIORITÀ 1: Verifica SEMPRE sul backend GitHub PRIMA (fonte di verità)
  // Il backend è l'unica fonte affidabile che non può essere manipolata
  const gistId = localStorage.getItem('github_gist_id');
  const githubToken = getGitHubToken();
  
  if (gistId && githubToken) {
    try {
      const hasAttempted = await checkGitHubBackend(ip, today, day);
      if (hasAttempted) {
        // Aggiorna la cache locale per performance future
        localStorage.setItem(cacheKey, 'true');
        return true;
      }
      // Se il backend dice che non ha tentato, aggiorna la cache negativa
      localStorage.setItem(cacheKey, 'false');
      return false;
    } catch (error) {
      console.error('Errore CRITICO nel controllo backend GitHub:', error);
      // Se il backend fallisce, NON possiamo permettere il tentativo per sicurezza
      // Usa la cache locale come ultimo fallback, ma è meno sicuro
      // In produzione, dovresti bloccare il tentativo se il backend non risponde
    }
  } else {
    // Backend non configurato - usa solo cache locale (MENO SICURO)
    console.warn('ATTENZIONE: Backend GitHub non configurato - usando solo cache locale (non sicuro)');
  }

  // FALLBACK: Controlla la cache locale (solo se backend non disponibile)
  // NOTA: Questo può essere bypassato cancellando la cronologia
  const cached = localStorage.getItem(cacheKey);
  if (cached === 'true') {
    return true;
  }

  // Verifica anche nei tentativi salvati per lo stesso IP oggi
  const attemptsKey = `all_attempts_${today}`;
  const existingAttempts = localStorage.getItem(attemptsKey);
  if (existingAttempts) {
    try {
      const attempts: AttemptRecord[] = JSON.parse(existingAttempts);
      const hasAttempted = attempts.some(attempt => attempt.ip === ip && attempt.day === day);
      if (hasAttempted) {
        localStorage.setItem(cacheKey, 'true');
        return true;
      }
    } catch (error) {
      console.warn('Errore nel parsing dei tentativi salvati:', error);
    }
  }

  return false;
}

/**
 * Registra un tentativo per l'IP corrente
 * PRIORITÀ: Backend GitHub (fonte di verità) -> localStorage (cache)
 * IMPORTANTE: Il backend GitHub è OBBLIGATORIO per la sicurezza
 */
export async function recordAttempt(ip: string, day: number): Promise<void> {
  const today = getTodayDateString();
  const cacheKey = `attempt_${ip}_${today}_${day}`;
  
  // Crea il record del tentativo
  const attempt: AttemptRecord = {
    ip,
    date: today,
    day,
    timestamp: Date.now()
  };
  
  // PRIORITÀ 1: Salva SEMPRE sul backend GitHub PRIMA (fonte di verità)
  const gistId = localStorage.getItem('github_gist_id');
  const githubToken = getGitHubToken();
  
  if (gistId && githubToken) {
    try {
      await saveToGitHubBackend(attempt);
      // Solo dopo il successo sul backend, aggiorna la cache locale
      localStorage.setItem(cacheKey, 'true');
      
      // Salva anche un record completo in cache locale
      const attemptsKey = `all_attempts_${today}`;
      const existingAttempts = localStorage.getItem(attemptsKey);
      let attempts: AttemptRecord[] = existingAttempts ? JSON.parse(existingAttempts) : [];
      // Evita duplicati
      if (!attempts.some(a => a.ip === ip && a.day === day)) {
        attempts.push(attempt);
        localStorage.setItem(attemptsKey, JSON.stringify(attempts));
      }
      return; // Successo, esci
    } catch (error) {
      console.error('Errore CRITICO nel salvataggio su GitHub backend:', error);
      // Se il backend fallisce, è un problema serio
      // In produzione, dovresti bloccare il tentativo se il backend non risponde
      // Per ora, salviamo in cache locale come fallback (MENO SICURO)
      throw new Error('Impossibile salvare il tentativo sul backend. Il tentativo potrebbe non essere tracciato correttamente.');
    }
  } else {
    // Backend non configurato - usa solo cache locale (MENO SICURO)
    console.warn('ATTENZIONE: Backend GitHub non configurato - usando solo cache locale (non sicuro)');
  }

  // FALLBACK: Se backend non configurato o fallito, salva solo in cache locale
  // NOTA: Questo è meno sicuro e può essere bypassato cancellando la cronologia
  localStorage.setItem(cacheKey, 'true');
  
  const attemptsKey = `all_attempts_${today}`;
  const existingAttempts = localStorage.getItem(attemptsKey);
  let attempts: AttemptRecord[] = existingAttempts ? JSON.parse(existingAttempts) : [];
  if (!attempts.some(a => a.ip === ip && a.day === day)) {
    attempts.push(attempt);
    localStorage.setItem(attemptsKey, JSON.stringify(attempts));
  }
}

/**
 * Controlla sul backend GitHub se l'IP ha già tentato oggi
 * Usa GitHub Gists API per salvare i tentativi
 */
async function checkGitHubBackend(ip: string, date: string, day: number): Promise<boolean> {
  const gistId = localStorage.getItem('github_gist_id');
  if (!gistId) {
    throw new Error('Backend GitHub non configurato');
  }

  try {
    // Leggi il gist (pubblico, non serve autenticazione per leggere)
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      // Aggiungi timeout per evitare attese infinite
      signal: AbortSignal.timeout(10000) // 10 secondi
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Gist non trovato - backend non valido');
      }
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const gist = await response.json();
    const filename = `attempts_${date}.json`;
    const file = gist.files[filename];
    
    if (!file) {
      return false; // Nessun tentativo per oggi
    }

    const attempts: AttemptRecord[] = JSON.parse(file.content);
    return attempts.some(attempt => attempt.ip === ip && attempt.day === day);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout nel controllo backend - verifica la connessione');
    }
    console.error('Errore nel controllo GitHub backend:', error);
    throw error; // Rilancia l'errore invece di ritornare false
  }
}

/**
 * Salva un tentativo sul backend GitHub
 * Richiede un GitHub Personal Access Token configurato
 */
async function saveToGitHubBackend(attempt: AttemptRecord): Promise<void> {
  const gistId = localStorage.getItem('github_gist_id');
  const githubToken = getGitHubToken();
  
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
 * Verifica lo stato del backend GitHub
 * Restituisce informazioni dettagliate sulla configurazione
 */
export async function verifyBackendStatus(): Promise<{
  configured: boolean;
  tokenPresent: boolean;
  gistIdPresent: boolean;
  connectionOk: boolean;
  error?: string;
  gistId?: string;
}> {
  const githubToken = getGitHubToken();
  const gistId = localStorage.getItem('github_gist_id');
  
  const result = {
    configured: false,
    tokenPresent: !!githubToken,
    gistIdPresent: !!gistId,
    connectionOk: false,
    gistId: gistId || undefined
  };

  // Se manca token o Gist ID, non è configurato
  if (!githubToken || !gistId) {
    return result;
  }

  result.configured = true;

  // Testa la connessione al backend
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(10000) // 10 secondi timeout
    });

    if (response.ok) {
      result.connectionOk = true;
    } else {
      if (response.status === 404) {
        throw new Error('Gist non trovato - potrebbe essere stato eliminato');
      } else if (response.status === 401) {
        throw new Error('Token non valido o scaduto');
      } else {
        throw new Error(`Errore HTTP: ${response.status}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout - verifica la connessione internet');
      } else {
        throw error;
      }
    } else {
      throw new Error('Errore sconosciuto nel test di connessione');
    }
  }

  return result;
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

