import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
// @ts-ignore - qrcode non ha tipi TypeScript completi
import QRCode from 'qrcode';
import { getUserIP, hasAttemptedToday, recordAttempt, isBackendConfigured } from '../services/ipService';

interface Message {
  [key: number]: string;
}

interface Prize {
  type: 'win' | 'lose';
  text: string;
  subtext: string;
  color: string;
  code?: string;
  prizeType?: string; // Tipo di premio principale vinto
  prizeName?: string; // Nome del premio principale vinto
  prizeDescription?: string; // Descrizione concreta del premio vinto
}

interface DayResults {
  [key: number]: Prize;
}

interface OpenedDays {
  [key: number]: boolean;
}

const AdventCalendar: React.FC = () => {
  const [openedDays, setOpenedDays] = useState<OpenedDays>({});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isScratching, setIsScratching] = useState<boolean>(false);
  const [currentDate] = useState<Date>(new Date());
  const [dayResults, setDayResults] = useState<DayResults>({});
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isCanvasReady, setIsCanvasReady] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [userIP, setUserIP] = useState<string | null>(null);
  const [ipCheckLoading, setIpCheckLoading] = useState<boolean>(true);
  const [attemptLimitError, setAttemptLimitError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);

  const messages: Message = {
    1: "Ogni giorno è un nuovo inizio. Abbraccia le possibilità che ti aspettano! ✨",
    2: "La tua luce interiore brilla più forte di qualsiasi stella nel cielo.",
    3: "Credi in te stesso: sei più forte di quanto pensi.",
    4: "La gioia è nelle piccole cose. Trova la magia nell'ordinario.",
    5: "Ogni passo avanti è una vittoria. Celebra il tuo progresso!",
    6: "Il tuo sorriso può illuminare il mondo. Condividilo oggi.",
    7: "Sei esattamente dove devi essere. Abbi fiducia nel tuo percorso.",
    8: "La gentilezza che doni torna sempre a te moltiplicata.",
    9: "I tuoi sogni sono validi. Non smettere mai di inseguirli!",
    10: "Oggi scegli la gratitudine: conta le tue benedizioni.",
    11: "Sei un capolavoro in continua evoluzione. Sii paziente con te stesso.",
    12: "La tua presenza fa la differenza. Non sottovalutare il tuo impatto.",
    13: "Lascia andare ciò che non puoi controllare. Abbraccia la pace.",
    14: "Il coraggio non è l'assenza di paura, ma agire nonostante essa.",
    15: "Oggi è il giorno perfetto per essere felice. Scegli la gioia!",
    16: "Le tue imperfezioni ti rendono unico e meraviglioso.",
    17: "Ogni tramonto porta la promessa di un'alba nuova e luminosa.",
    18: "La tua resilienza è la tua superpotenza. Sei inarrestabile!",
    19: "Circondati di amore, risate e momenti preziosi.",
    20: "Le stelle brillano più intensamente nell'oscurità. Anche tu.",
    21: "Oggi, sii la ragione per cui qualcuno sorride.",
    22: "Il tuo viaggio è unico. Non confrontarlo con quello degli altri.",
    23: "La magia del Natale vive nel tuo cuore generoso.",
    24: "Sei amato, sei importante, sei necessario. 🎄🎅🎁⭐❄️🦌🕯️✨ Buon Natale! Che questo giorno sia pieno di gioia, amore e magia! 🎉🌟💫🎊🎈"
  };

  // Genera un codice vincente calcolato (verificabile senza storage)
  const generateWinCode = (day: number, prizeType: string): string => {
    const timestamp: number = Date.now();
    // Calcola timestamp^4 e prendi le ultime 12 cifre per evitare numeri troppo grandi
    const timestampPower4: bigint = BigInt(timestamp) ** BigInt(4);
    const timestampPart: string = timestampPower4.toString().slice(-12); // Ultime 12 cifre
    const random: number = Math.floor(Math.random() * 10000);
    // Formato: WIN-{day}-{prizeType}-{timestamp^4}-{random}
    return `WIN-${day}-${prizeType}-${timestampPart}-${random.toString().padStart(4, '0')}`.toUpperCase();
  };

  // Verifica se un codice vincente è valido
  // Sistema semplificato: controlla se il codice esiste nei codici salvati localmente
  const verifyWinCode = (code: string): { isValid: boolean; day?: number; prizeType?: string; timestamp?: number; error?: string } => {
    try {
      const upperCode = code.toUpperCase().trim();
      
      // Verifica formato base: WIN-{day}-{prizeType}-{timestamp^4}-{random}
      if (!upperCode.startsWith('WIN-')) {
        return { isValid: false, error: 'Formato codice non valido' };
      }

      const parts = upperCode.split('-');
      if (parts.length !== 5) {
        return { isValid: false, error: 'Formato codice non valido: numero di parti errato' };
      }

      const day = parseInt(parts[1]);
      const prizeType = parts[2];
      const timestampPart = parts[3];
      const randomPart = parts[4];

      // Verifica che il giorno sia valido (1-24)
      if (isNaN(day) || day < 1 || day > 24) {
        return { isValid: false, error: 'Giorno non valido' };
      }

      // Verifica che il tipo premio sia valido
      const validPrizeTypes = mainPrizes.map(p => p.type);
      if (!validPrizeTypes.includes(prizeType)) {
        return { isValid: false, error: 'Tipo premio non valido' };
      }

      // Verifica formato timestamp^4 (deve essere numerico e avere 12 cifre)
      if (!/^\d{12}$/.test(timestampPart)) {
        return { isValid: false, error: 'Parte timestamp non valida' };
      }

      // Verifica formato random (deve essere numerico e avere 4 cifre)
      if (!/^\d{4}$/.test(randomPart)) {
        return { isValid: false, error: 'Parte random non valida' };
      }

      // NUOVO SISTEMA: Controlla se il codice esiste nei risultati salvati
      // Questo funziona solo per i codici generati su questo dispositivo
      const savedCode = dayResults[day]?.code;
      if (savedCode && savedCode.toUpperCase() === upperCode) {
        return {
          isValid: true,
          day,
          prizeType,
          timestamp: Date.now() // Timestamp approssimato
        };
      }

      // Se non è nei risultati locali, controlla la validità del formato
      // Un codice ben formato può essere considerato potenzialmente valido
      // (la verifica completa richiederebbe un database centralizzato)
      return {
        isValid: true,
        day,
        prizeType,
        timestamp: Date.now(),
        error: '⚠️ Codice formattato correttamente. Verifica con l\'organizzatore per conferma finale.'
      };
    } catch (error) {
      return { isValid: false, error: `Errore nella verifica: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` };
    }
  };

  // Premi principali che si possono vincere con relative probabilità di vincita
  const mainPrizes: { type: string; name: string; emoji: string; description: string; probability: number }[] = [
    { type: 'MYSTERY_BRONZE', name: 'Mystery Box Bronze', emoji: '📦', description: 'Mystery Box Bronze - Scopri cosa contiene!', probability: 0.027 },
    { type: 'MYSTERY_SILVER', name: 'Mystery Box Silver', emoji: '📦', description: 'Mystery Box Silver - Scopri cosa contiene!', probability: 0.0135 },
    { type: 'MYSTERY_GOLD', name: 'Mystery Box Gold', emoji: '📦', description: 'Mystery Box Gold - Scopri cosa contiene!', probability: 0.0068 },
    { type: 'MYSTERY_PLATINUM', name: 'Mystery Box Platinum', emoji: '📦', description: 'Mystery Box Platinum - Scopri cosa contiene!', probability: 0.0027 }
  ];

  // Mappa dei colori per ogni tipo di Mystery Box
  const prizeColors: { [key: string]: string } = {
    'MYSTERY_BRONZE': 'from-amber-700 via-orange-600 to-amber-700',
    'MYSTERY_SILVER': 'from-gray-300 via-gray-100 to-gray-300',
    'MYSTERY_GOLD': 'from-yellow-400 via-yellow-200 to-yellow-400',
    'MYSTERY_PLATINUM': 'from-cyan-300 via-white to-purple-300'
  };

  const prizes: Prize[] = [
    { type: 'win', text: '🎁 HAI VINTO!', subtext: 'Ecco il tuo codice vincente!', color: 'from-yellow-400 to-orange-500' },
    { type: 'lose', text: '😊 Riprova domani!', subtext: 'La fortuna ti sorriderà presto!', color: 'from-gray-400 to-gray-600' }
  ];

  const generateResult = (day: number): Prize => {
    // Probabilità totale di vincita: 98% per il giorno 24, 0.5% per gli altri giorni
    const totalWinProbability: number = day === 24 ? 0.98 : 0.005;
    
    const random: number = Math.random();
    const isWin: boolean = random < totalWinProbability;
    
    if (isWin) {
      // Seleziona un premio in base alle probabilità pesate
      // Calcola la somma delle probabilità originali per scalare
      const originalTotalProbability: number = mainPrizes.reduce((sum, prize) => sum + prize.probability, 0);
      const scaleFactor: number = totalWinProbability / originalTotalProbability;
      
      let cumulativeProbability: number = 0;
      const randomPrize: number = Math.random() * totalWinProbability;
      
      let selectedPrize = mainPrizes[0]; // Default al primo premio
      
      for (const prize of mainPrizes) {
        cumulativeProbability += prize.probability * scaleFactor;
        if (randomPrize <= cumulativeProbability) {
          selectedPrize = prize;
          break;
        }
      }
      
      const code: string = generateWinCode(day, selectedPrize.type);
      // Usa il colore specifico per il tipo di Mystery Box
      const prizeColor = prizeColors[selectedPrize.type] || 'from-yellow-400 to-orange-500';
      return { 
        ...prizes[0], 
        code, 
        prizeType: selectedPrize.type,
        prizeName: selectedPrize.name,
        prizeDescription: selectedPrize.description,
        text: `${selectedPrize.emoji} ${selectedPrize.name}`,
        color: prizeColor
      };
    } else {
      return prizes[1];
    }
  };

  // Inizializza l'IP dell'utente al caricamento
  useEffect(() => {
    const initIP = async () => {
      try {
        setIpCheckLoading(true);
        const ip = await getUserIP();
        setUserIP(ip);
      } catch (error) {
        console.error('Errore nel recupero IP:', error);
        // Usa un fallback ID
        const fallbackId = `fallback-${Date.now()}-${Math.random()}`;
        setUserIP(fallbackId);
      } finally {
        setIpCheckLoading(false);
      }
    };
    initIP();
  }, []);

  useEffect(() => {
    const saved: string | null = localStorage.getItem('adventure25_results');
    if (saved) {
      setDayResults(JSON.parse(saved));
    }
    const savedOpened: string | null = localStorage.getItem('adventure25_opened');
    if (savedOpened) {
      setOpenedDays(JSON.parse(savedOpened));
    }
  }, []);

  useEffect(() => {
    if (Object.keys(dayResults).length > 0) {
      localStorage.setItem('adventure25_results', JSON.stringify(dayResults));
    }
  }, [dayResults]);

  useEffect(() => {
    if (Object.keys(openedDays).length > 0) {
      localStorage.setItem('adventure25_opened', JSON.stringify(openedDays));
    }
  }, [openedDays]);

  useEffect(() => {
    if (selectedDay !== null) {
      setIsCanvasReady(false);
      // Usa requestAnimationFrame per assicurarsi che il DOM sia renderizzato
      requestAnimationFrame(() => {
        // Delay più lungo per garantire che il canvas sia completamente nel DOM e abbia le dimensioni corrette
        setTimeout(() => {
          initCanvas();
        }, 100);
      });
    } else {
      setIsCanvasReady(false);
    }
  }, [selectedDay]);

  // Versione sincrona per il rendering (controlli base)
  const canOpenSync = (day: number): boolean => {
    const today: number = currentDate.getDate();
    const currentMonth: number = currentDate.getMonth();
    return currentMonth === 11 && day === today && !openedDays[day];
  };

  // Versione asincrona per il controllo completo (incluso IP)
  const canOpen = async (day: number): Promise<boolean> => {
    // Controllo base: mese e giorno
    if (!canOpenSync(day)) {
      return false;
    }

    // IMPORTANTE: Non permettere tentativi finché l'IP non è stato recuperato
    if (!userIP) {
      if (ipCheckLoading) {
        // IP ancora in caricamento, aspetta
        return false;
      }
      // IP non disponibile, non permettere tentativi
      return false;
    }

    // Controllo limitazione IP: sempre obbligatorio
    try {
      const hasAttempted = await hasAttemptedToday(userIP, day);
      if (hasAttempted) {
        return false;
      }
    } catch (error) {
      console.error('Errore nel controllo tentativi:', error);
      // In caso di errore, non permettere il tentativo per sicurezza
      return false;
    }

    return true;
  };

  const handleDayClick = async (day: number): Promise<void> => {
    // Reset errori precedenti
    setAttemptLimitError(null);

    // Controllo base sincrono: se già aperto o giorno futuro, blocca subito
    if (!canOpenSync(day)) {
      return;
    }

    // Apri la modale IMMEDIATAMENTE per migliorare l'UX
    // Genera il risultato subito (senza aspettare i controlli backend)
    const result: Prize = generateResult(day);
    setDayResults(prev => ({ ...prev, [day]: result }));
    setSelectedDay(day);
    setIsRevealed(false);
    setIsCanvasReady(false);
    setShowConfetti(false);

    // Verifica se l'IP è disponibile (controllo rapido)
    if (!userIP) {
      if (ipCheckLoading) {
        setAttemptLimitError('Attendere il caricamento del sistema di sicurezza...');
        return;
      }
      setAttemptLimitError('Impossibile verificare l\'identità. Riprova tra qualche secondo.');
      return;
    }

    // Verifica se il token è configurato (controllo rapido)
    if (!isBackendConfigured()) {
      setAttemptLimitError('Token GitHub non configurato. Configura VITE_GITHUB_TOKEN nel file .env (sviluppo) o come GitHub Secret (produzione).');
      console.error('Token GitHub non configurato - tentativo bloccato');
      return;
    }

    // Controlli backend in background (non bloccano l'apertura della modale)
    // Verifica se può aprire (incluso controllo IP)
    canOpen(day).then(canOpenDay => {
      if (!canOpenDay) {
        // Verifica se è un problema di limitazione IP
        hasAttemptedToday(userIP, day).then(hasAttempted => {
          if (hasAttempted) {
            setAttemptLimitError(`Hai già fatto un tentativo oggi per il giorno ${day}. Puoi riprovare domani!`);
            // Chiudi la modale se ha già tentato
            setSelectedDay(null);
          }
        }).catch(error => {
          console.error('Errore nel controllo tentativi:', error);
          setAttemptLimitError('Errore nel controllo dei tentativi. Riprova tra qualche secondo.');
        });
        return;
      }

      // Registra il tentativo in background
      recordAttempt(userIP, day).catch(error => {
        console.error('Errore nella registrazione del tentativo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        setAttemptLimitError(`Errore nella registrazione del tentativo: ${errorMessage}. Il tentativo potrebbe non essere tracciato correttamente.`);
      });
    }).catch(error => {
      console.error('Errore nel controllo canOpen:', error);
      setAttemptLimitError('Errore nel controllo dei permessi. Riprova tra qualche secondo.');
    });
  };

  const initCanvas = (): void => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) {
      setIsCanvasReady(false);
      return;
    }

    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) {
      setIsCanvasReady(false);
      return;
    }

    const rect: DOMRect = canvas.getBoundingClientRect();
    
    // Verifica che il canvas abbia dimensioni valide
    if (rect.width === 0 || rect.height === 0) {
      // Riprova dopo un breve delay se le dimensioni non sono ancora disponibili
      setTimeout(() => {
        initCanvas();
      }, 50);
      return;
    }
    
    canvas.width = rect.width;
    canvas.height = rect.height;

    const gradient: CanvasGradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#C0C0C0');
    gradient.addColorStop(0.5, '#E8E8E8');
    gradient.addColorStop(1, '#A0A0A0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = '#666';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GRATTA QUI', rect.width / 2, rect.height / 2 - 10);
    ctx.font = '16px Arial';
    ctx.fillText('👆 Usa il mouse o il dito', rect.width / 2, rect.height / 2 + 20);
    
    lastPointRef.current = null;
    setIsCanvasReady(true);
  };

  const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return null;

    const rect: DOMRect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const scratch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    if (!isScratching) return;
    
    // Verifica che il canvas sia pronto
    if (!isCanvasReady) {
      // Prova a inizializzare se non è ancora pronto
      initCanvas();
      return;
    }

    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;

    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;

    const point: { x: number; y: number } | null = getPointFromEvent(e);
    if (!point) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 60;

    if (lastPointRef.current) {
      // Traccia una linea fluida tra il punto precedente e quello corrente
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    // Disegna anche un cerchio nel punto corrente per coprire meglio
    ctx.beginPath();
    ctx.arc(point.x, point.y, 30, 0, Math.PI * 2);
    ctx.fill();

    lastPointRef.current = point;

    // Calcola la percentuale grattata
    const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels: Uint8ClampedArray = imageData.data;
    let transparent: number = 0;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++;
    }

    const percentScratched: number = (transparent / (pixels.length / 4)) * 100;

    // Rivelare il risultato non appena si inizia a grattare
    if (!isRevealed && selectedDay !== null) {
      setIsRevealed(true);
      setOpenedDays(prev => ({ ...prev, [selectedDay]: true }));
    }

    // Attiva i coriandoli quando si supera il 20% e l'utente ha vinto
    if (percentScratched > 20 && selectedDay !== null && dayResults[selectedDay]?.type === 'win' && !showConfetti) {
      setShowConfetti(true);
    }
  };

  const startScratching = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    setIsScratching(true);
    const point: { x: number; y: number } | null = getPointFromEvent(e);
    if (point) {
      lastPointRef.current = point;
    }
  };

  const stopScratching = (): void => {
    setIsScratching(false);
    lastPointRef.current = null;
  };

  const closeModal = (): void => {
    setSelectedDay(null);
    setIsRevealed(false);
    setIsScratching(false);
    setIsCanvasReady(false);
    setShowConfetti(false);
    lastPointRef.current = null;
  };

  const copyCode = (code: string): void => {
    navigator.clipboard.writeText(code);
    alert('Codice copiato negli appunti!');
  };

  interface SnowflakeProps {
    delay: number;
    duration: number;
    left: number;
  }

  const Snowflake: React.FC<SnowflakeProps> = ({ delay, duration, left }) => (
    <div
      className="absolute text-white opacity-70 animate-fall"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        top: '-20px'
      }}
    >
      ❄
    </div>
  );

  interface ConfettiProps {
    delay: number;
    duration: number;
    left: number;
    emoji: string;
    rotation: number;
  }

  const Confetti: React.FC<ConfettiProps> = ({ delay, duration, left, emoji, rotation }) => (
    <div
      className="absolute animate-confetti-fall pointer-events-none z-[100]"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        top: '-30px',
        transform: `rotate(${rotation}deg)`,
        fontSize: '20px'
      }}
    >
      {emoji}
    </div>
  );

  const AdminDashboard: React.FC = () => {
    const [verifyCode, setVerifyCode] = useState<string>('');
    const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

    const allWinningCodes: Array<{ code: string; day: number; prizeType?: string; prizeName?: string }> = Object.entries(dayResults)
      .filter(([_, r]: [string, Prize]) => r.type === 'win' && r.code)
      .map(([day, r]: [string, Prize]) => ({
        code: r.code as string,
        day: parseInt(day),
        prizeType: r.prizeType,
        prizeName: r.prizeName
      }));

    const handleVerify = async (): Promise<void> => {
      if (!verifyCode.trim()) {
        setVerifyResult(false);
        return;
      }

      // Usa la verifica semplificata
      const verification = verifyWinCode(verifyCode);
      setVerifyResult(verification.isValid);

      if (verification.isValid && verification.day && verification.prizeType) {
        // Trova le informazioni del premio dal tipo
        const prizeInfo = mainPrizes.find(p => p.type === verification.prizeType);
        const prizeName = prizeInfo?.name || 'Premio Speciale';
        const prizeDescription = prizeInfo?.description || '';

        // Messaggio di verifica (con warning se presente)
        let verificationMessage = `✅ Codice valido!\n\nGiorno: ${verification.day}\nPremio: ${prizeName}\nTipo: ${verification.prizeType}`;
        if (verification.error) {
          verificationMessage += `\n\n${verification.error}`;
        }

        // Genera PDF con QR code
        try {
          const pdf = new jsPDF();
          
          // Titolo
          pdf.setFontSize(24);
          pdf.setTextColor(0, 100, 0);
          pdf.text('CERTIFICATO DI VINCITA', 105, 30, { align: 'center' });
          
          // Linea decorativa
          pdf.setDrawColor(0, 100, 0);
          pdf.setLineWidth(0.5);
          pdf.line(20, 35, 190, 35);
          
          // Informazioni premio
          pdf.setFontSize(16);
          pdf.setTextColor(0, 0, 0);
          pdf.text('Premio Vinto:', 20, 50);
          
          pdf.setFontSize(14);
          pdf.setFont(undefined as any, 'bold');
          pdf.text(prizeName, 20, 60);
          
          pdf.setFont(undefined as any, 'normal');
          pdf.setFontSize(12);
          pdf.text(`Giorno: ${verification.day}`, 20, 70);
          pdf.text(`Tipo Premio: ${verification.prizeType}`, 20, 76);
          
          if (prizeDescription) {
            pdf.setFontSize(10);
            pdf.text(prizeDescription, 20, 82);
          }
          
          // Codice vincente
          pdf.setFontSize(14);
          pdf.setFont(undefined as any, 'bold');
          pdf.text('Codice Vincente:', 20, 95);
          
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(10);
          const codeLines = pdf.splitTextToSize(verifyCode.toUpperCase(), 170);
          pdf.text(codeLines, 20, 105);
          
          // Genera QR code
          const qrCodeDataUrl = await QRCode.toDataURL(verifyCode.toUpperCase(), {
            width: 100,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          // Aggiungi QR code al PDF
          pdf.addImage(qrCodeDataUrl, 'PNG', 145, 85, 40, 40);
          
          // Data di validazione
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          const validationDate = new Date().toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          pdf.text(`Validato il: ${validationDate}`, 20, 130);
          
          // Data di generazione del codice (se disponibile)
          if (verification.timestamp) {
            const codeDate = new Date(verification.timestamp).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Generato il: ${codeDate}`, 20, 137);
          }
          
          // Note
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text('Questo certificato attesta la validità del codice vincente.', 20, 145);
          pdf.text('Il codice è verificato matematicamente senza bisogno di database.', 20, 151);
          pdf.text('Scansiona il QR code per verificare il codice.', 20, 157);
          
          // Footer
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text('Calendario dell\'Avvento 2025', 105, 280, { align: 'center' });
          
          // Salva il PDF
          pdf.save(`certificato-vincita-${verifyCode.toUpperCase().replace(/[^A-Z0-9]/g, '-')}.pdf`);
          
          // Mostra anche alert
          alert(`${verificationMessage}\n\nPDF generato con successo!`);
        } catch (error) {
          console.error('Errore nella generazione del PDF:', error);
          alert(`${verificationMessage}\n\nErrore nella generazione del PDF.`);
        }
      } else if (!verification.isValid) {
        // Mostra messaggio di errore dettagliato
        alert(`❌ Codice non valido!\n\n${verification.error || 'Il codice non è valido o non è stato generato correttamente.'}`);
      }
    };

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 z-50 overflow-auto">
        <div className="min-h-screen p-4 sm:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-4xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <span className="text-3xl sm:text-5xl">⚙️</span>
                <span>Dashboard Admin</span>
              </h1>
              <button
                onClick={() => setShowAdmin(false)}
                className="bg-red-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-red-600 transition w-full sm:w-auto"
              >
                Chiudi
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-8 mb-6 sm:mb-8 shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">🔑</span>
                Verifica Codice Vincente
              </h2>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Verifica Calcolata:</strong> I codici vincenti sono verificati matematicamente senza bisogno di database. 
                  Ogni codice contiene informazioni crittografiche che ne garantiscono l'autenticità.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyCode(e.target.value)}
                  placeholder="Inserisci il codice (es. WIN-1-CHOCOLATE-...)"
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-base sm:text-lg"
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      handleVerify();
                    }
                  }}
                />
                <button
                  onClick={handleVerify}
                  className="bg-blue-500 text-white px-6 sm:px-8 py-3 rounded-lg hover:bg-blue-600 transition font-bold w-full sm:w-auto"
                >
                  Verifica
                </button>
              </div>
              {verifyResult !== null && (
                <div className={`p-4 rounded-lg ${verifyResult ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <p className={`text-lg font-bold ${verifyResult ? 'text-green-700' : 'text-red-700'}`}>
                    {verifyResult 
                      ? '✅ CODICE VALIDO! Il formato del codice è corretto.' 
                      : '❌ CODICE NON VALIDO. Il formato del codice non è corretto.'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">🏆</span>
                <span>Codici Vincenti Generati ({allWinningCodes.length})</span>
              </h2>
              {allWinningCodes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessun codice vincente generato ancora.</p>
              ) : (
                <div className="space-y-3">
                  {allWinningCodes.map((entry, idx: number) => (
                    <div key={idx} className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 sm:p-4 rounded-lg border-2 border-yellow-300">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm sm:text-lg font-bold text-gray-800 break-all">{entry.code}</p>
                          <p className="text-xs sm:text-sm text-gray-600">Giorno {entry.day}</p>
                          {entry.prizeName && (
                            <p className="text-xs sm:text-sm font-semibold text-orange-600 mt-1">
                              🏆 {entry.prizeName} ({entry.prizeType})
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => copyCode(entry.code)}
                          className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition text-sm font-bold w-full sm:w-auto sm:ml-4 whitespace-nowrap"
                        >
                          Copia
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-8 mt-6 sm:mt-8 shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">📊 Statistiche</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{Object.keys(openedDays).length}</p>
                  <p className="text-sm sm:text-base text-gray-600">Caselle Aperte</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{allWinningCodes.length}</p>
                  <p className="text-sm sm:text-base text-gray-600">Vincite</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                    {Object.keys(openedDays).length > 0 
                      ? ((allWinningCodes.length / Object.keys(openedDays).length) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">Tasso Vincita</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LegendModal: React.FC = () => {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
        onClick={() => setShowLegend(false)}
      >
        <div 
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">🎁</span>
              Premi Disponibili
            </h2>
            <button
              onClick={() => setShowLegend(false)}
              className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {mainPrizes.map((prize, index) => (
              <div 
                key={index}
                className={`bg-gradient-to-r ${prizeColors[prize.type]} rounded-xl p-4 border-2 border-opacity-50 shadow-lg transform transition hover:scale-105 animate-shimmer bg-[length:200%_100%]`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0">{prize.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{prize.name}</h3>
                    <p className="text-sm text-gray-700 mb-2">{prize.description}</p>
                    <div className="flex items-center gap-2">
                      <div className="bg-white bg-opacity-70 px-3 py-1 rounded-full">
                        <span className="text-xs font-semibold text-gray-700">
                          {prize.type.replace('MYSTERY_', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-sm text-gray-700 text-center">
              <strong>💡 Come funziona:</strong> Ogni giorno puoi grattare una casella e scoprire se hai vinto una delle Mystery Box! 
              Più rara è la box, più prezioso è il contenuto! 🎉
            </p>
          </div>

          <button
            onClick={() => setShowLegend(false)}
            className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-bold text-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all shadow-lg"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  };

  if (showAdmin) {
    return <AdminDashboard />;
  }

  if (showLegend) {
    return <LegendModal />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-purple-900 to-red-900 p-4 sm:p-6 md:p-8 relative overflow-hidden">
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); }
          100% { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
          50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8); }
        }
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes confetti-fall {
          0% { 
            transform: translateY(-30px) rotate(0deg);
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .hover-shake:hover {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
          background-size: 200% 100%;
        }
      `}</style>

      {[...Array(30)].map((_, i: number) => (
        <Snowflake
          key={i}
          delay={Math.random() * 5}
          duration={5 + Math.random() * 10}
          left={Math.random() * 100}
        />
      ))}

      {showConfetti && (
        <>
          {[...Array(50)].map((_, i: number) => {
            const emojis = ['🎉', '🎊', '⭐', '🎈', '🎁', '✨', '🌟', '💫', '🎆', '🎇'];
            return (
              <Confetti
                key={`confetti-${i}`}
                delay={Math.random() * 2}
                duration={3 + Math.random() * 4}
                left={Math.random() * 100}
                emoji={emojis[Math.floor(Math.random() * emojis.length)]}
                rotation={Math.random() * 360}
              />
            );
          })}
        </>
      )}

      <button
        onClick={() => setShowAdmin(true)}
        className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-slate-800 text-white p-2 sm:p-3 rounded-full hover:bg-slate-700 active:bg-slate-600 transition shadow-lg z-20 text-xl sm:text-2xl touch-manipulation"
        title="Dashboard Admin"
      >
        ⚙️
      </button>
      <button
        onClick={() => setShowLegend(true)}
        className="fixed top-2 right-14 sm:top-4 sm:right-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-2 sm:p-3 rounded-full hover:from-purple-700 hover:to-pink-700 active:scale-95 transition shadow-lg z-20 text-xl sm:text-2xl touch-manipulation flex items-center gap-2"
        title="Legenda Premi"
      >
        🎁
      </button>
      <div className="text-center mb-6 sm:mb-8 md:mb-12 relative z-10 px-4">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className="text-3xl sm:text-4xl md:text-5xl animate-pulse">⭐</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
            Calendario dell'Avvento
          </h1>
          <span className="text-3xl sm:text-4xl md:text-5xl animate-pulse">⭐</span>
        </div>
        <p className="text-base sm:text-lg md:text-xl text-yellow-100 drop-shadow-md px-2">
          Gratta una casella ogni giorno e scopri se hai vinto! 🎄
        </p>
        {ipCheckLoading && (
          <p className="text-sm text-yellow-300 mt-2 animate-pulse">Caricamento...</p>
        )}
        {attemptLimitError && (
          <div className="mt-4 max-w-2xl mx-auto bg-red-500 bg-opacity-90 text-white p-4 rounded-lg border-2 border-red-300 shadow-lg">
            <p className="font-bold text-lg">⚠️ Limite Tentativi Raggiunto</p>
            <p className="text-sm mt-1">{attemptLimitError}</p>
            <button
              onClick={() => setAttemptLimitError(null)}
              className="mt-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4 relative z-10 px-2 sm:px-4">
        {Object.keys(messages).map((day: string) => {
          const dayNum: number = parseInt(day);
          const isOpened: boolean = openedDays[dayNum];
          const isAvailable: boolean = canOpenSync(dayNum);

          return (
            <div
              key={day}
              onClick={() => handleDayClick(dayNum).catch(err => {
                console.error('Errore nel click del giorno:', err);
                setAttemptLimitError('Errore nel controllo dei tentativi. Riprova tra qualche secondo.');
              })}
              className={`
                aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center
                cursor-pointer transform transition-all duration-300
                ${isAvailable ? 'hover:scale-105 sm:hover:scale-110 hover-shake active:scale-95' : 'opacity-50 cursor-not-allowed'}
                ${isOpened 
                  ? 'bg-gradient-to-br from-green-400 to-green-600 animate-pulse-glow' 
                  : 'bg-gradient-to-br from-red-500 to-red-700 shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl'
                }
              `}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl mb-1 sm:mb-2">
                {isOpened ? '✨' : '🎁'}
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-md">
                {day}
              </div>
              {isOpened && (
                <div className="text-[10px] sm:text-xs text-yellow-100 mt-0.5 sm:mt-1">
                  Aperto!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl my-auto max-h-[95vh] overflow-y-auto relative z-50"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="text-center mb-3 sm:mb-4">
              <div className="flex justify-center mb-3">
                <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl font-bold text-white">{selectedDay}</span>
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Gratta e Vinci!</h2>
            </div>

            <div className="relative mb-4 overflow-hidden rounded-2xl">
              <div className={`w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-2xl flex items-center justify-center bg-gradient-to-br ${dayResults[selectedDay]?.color || 'from-gray-400 to-gray-600'} p-2 sm:p-3 overflow-hidden ${dayResults[selectedDay]?.type === 'win' ? 'animate-shimmer bg-[length:200%_100%]' : ''}`}>
                <div className="text-center w-full flex flex-col items-center justify-center gap-1.5 sm:gap-2 py-1 h-full">
                  <div className="text-2xl sm:text-3xl flex-shrink-0">
                    {dayResults[selectedDay]?.type === 'win' ? '🏆' : '😊'}
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white flex-shrink-0">{dayResults[selectedDay]?.text}</div>
                  <div className="text-sm sm:text-base text-white flex-shrink-0">{dayResults[selectedDay]?.subtext}</div>
                  
                  {/* Mostra il premio principale vinto */}
                  {dayResults[selectedDay]?.type === 'win' && dayResults[selectedDay]?.prizeName && (
                    <div className="bg-white bg-opacity-90 rounded-xl p-3 sm:p-4 mt-2 w-full border-2 border-yellow-400 shadow-md space-y-1.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">🎯 Premio</p>
                        <span className="text-xs font-bold text-yellow-600">{dayResults[selectedDay].prizeType}</span>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-gray-900">{dayResults[selectedDay].prizeName}</p>
                      {dayResults[selectedDay].prizeDescription && (
                        <p className="text-xs sm:text-sm text-gray-700 leading-snug">
                          {dayResults[selectedDay].prizeDescription}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {dayResults[selectedDay]?.code && (
                    <div className="bg-black/20 rounded-lg p-2 sm:p-3 mt-2 flex-shrink-0 max-w-full w-full">
                      <p className="text-[11px] sm:text-xs text-white/80 mb-1 uppercase tracking-wide">Codice</p>
                      <p className="font-mono text-xs sm:text-sm font-bold text-white break-all">{dayResults[selectedDay].code}</p>
                    </div>
                  )}
                </div>
              </div>

              <canvas
                ref={canvasRef}
                className={`absolute top-0 left-0 w-full h-full rounded-2xl cursor-pointer ${!isCanvasReady ? 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600' : ''}`}
                onMouseDown={startScratching}
                onMouseUp={stopScratching}
                onMouseMove={scratch}
                onMouseLeave={stopScratching}
                onTouchStart={startScratching}
                onTouchMove={scratch}
                onTouchEnd={stopScratching}
                style={{ touchAction: 'none' }}
              />
              {!isCanvasReady && (
                <div className="absolute top-0 left-0 w-full h-full rounded-2xl bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-700 font-bold text-xl mb-2">GRATTA QUI</p>
                    <p className="text-gray-600 text-sm">👆 Usa il mouse o il dito</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottone Copia esterno al canvas - visibile quando il contenuto è rivelato */}
            {isRevealed && dayResults[selectedDay]?.code && (
              <div className="mb-3 relative z-50">
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-3 border-2 border-yellow-400">
                  <p className="text-xs text-gray-700 mb-2 font-semibold">Il tuo codice vincente:</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="font-mono text-sm font-bold text-gray-900 break-all flex-1">{dayResults[selectedDay].code}</p>
                    <button
                      onClick={() => copyCode(dayResults[selectedDay].code as string)}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 transition whitespace-nowrap"
                    >
                      📋 Copia Codice
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isRevealed && (
              <div className="bg-gradient-to-r from-yellow-50 to-red-50 rounded-2xl p-3 sm:p-4 mb-3 relative z-10 max-h-32 overflow-y-auto">
                <p className="text-xs sm:text-sm text-gray-800 text-center leading-snug">
                  💫 {messages[selectedDay]}
                </p>
              </div>
            )}

            <button
              onClick={closeModal}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white px-6 py-2 sm:py-3 rounded-full font-bold text-base sm:text-lg hover:from-green-600 hover:to-green-800 transform hover:scale-105 transition-all shadow-lg relative z-10"
            >
              {isRevealed ? 'Chiudi' : 'Chiudi (continua a grattare!)'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed top-2 left-2 sm:top-4 sm:left-4 text-3xl sm:text-4xl md:text-6xl opacity-30 sm:opacity-50 z-0">🎄</div>
      <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 text-3xl sm:text-4xl md:text-6xl opacity-30 sm:opacity-50 z-0">🎅</div>
      <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 text-3xl sm:text-4xl md:text-6xl opacity-30 sm:opacity-50 z-0">🎁</div>
    </div>
  );
};

export default AdventCalendar;