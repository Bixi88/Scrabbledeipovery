# Multiplayer di Scrabble deipovery: configurazione Firebase

Servono circa 10 minuti, nessuna carta di credito (piano gratuito "Spark").

## 1. Crea il progetto
1. Vai su https://console.firebase.google.com e accedi con il tuo account Google.
2. **Aggiungi progetto** → dagli un nome (es. `scrabble-deipovery`) → **Continua**.
3. Google Analytics: **disattivalo** (non serve) → **Crea progetto**.

## 2. Registra l'app web e copia la configurazione
1. Nella home del progetto clicca l'icona **Web** (`</>`).
2. Nome app: `scrabble` → **Registra app**. **Non** spuntare Firebase Hosting.
3. Compare un blocco `firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. **Copialo**.
4. Apri `index.html`, cerca `FIREBASE_CONFIG` e sostituisci i valori con i tuoi:

```js
const FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...'
};
```

(La `apiKey` di Firebase non è un segreto: può stare nel repository pubblico. A proteggere i dati sono le regole del punto 4.)

## 3. Attiva l'accesso anonimo
1. Menu a sinistra: **Build → Authentication** → **Inizia**.
2. Scheda **Metodo di accesso** → **Anonimo** → **Abilita** → **Salva**.

## 4. Crea il database e incolla le regole
1. **Build → Firestore Database** → **Crea database**.
2. Località: `eur3 (Europe)` (o `europe-west`) → **Avanti**.
3. Scegli **Modalità di produzione** → **Crea**.
4. Scheda **Regole**: cancella tutto, incolla il contenuto di `firestore.rules` e premi **Pubblica**.

## 5. Pubblica e prova
1. Carica su GitHub `index.html`, `sw.js`, `manifest.json` (nuove versioni). `firestore.rules` puoi tenerlo nel repo come promemoria, ma non viene usato dal sito.
2. Apri la PWA sul tuo telefono: compare "Come ti chiami?". Scrivi il nome → arrivi all'elenco partite.
3. **Nuova partita online** → **Invia su WhatsApp** → mandalo a lei.
4. Lei apre il link, scrive il suo nome e la partita compare a entrambi in "Tocca a te / Tocca a loro".

Se qualcosa non va, l'app mostra un messaggio. I più comuni:
- *"Accesso anonimo non attivo"* → punto 3.
- *"Permesso negato: controlla le regole di Firestore"* → punto 4 (regole non pubblicate o incollate male).

## Come funziona (in breve)
- Ogni partita è un documento Firestore `games/{id}` con board, rack, sacchetto, punteggi, turno, cronologia mosse e numero di versione. Ogni mossa è una transazione: se nel frattempo il documento è cambiato, la mossa viene rifiutata invece di sovrascrivere.
- La bozza (tessere posate ma non inviate) resta solo sul tuo telefono.
- `localStorage` continua a contenere solo la partita contro la CPU.
- Rack e sacchetto sono nello stesso documento e nascosti solo dall'interfaccia: va bene tra due persone di fiducia.
- Nickname e identità anonima stanno nello storage di Chrome/della PWA: se cancelli i dati del browser o cambi telefono perdi identità e partite (limite accettato).

## Regole scelte (modificabili)
- **Fine partita**: tessere e sacchetto finiti, oppure **4 turni consecutivi senza punti** (passo o cambio; due a testa), oppure resa. Il limite è la costante `MP_PASS_LIMIT` in `index.html`.
- **Penalità**: a fine partita (non in caso di resa) ognuno perde il valore delle tessere rimaste in mano. Chi finisce le tessere non incassa quelle dell'altro.
- **Resa**: vince l'altra persona a prescindere dai punti.
- **Rivincita**: inizia chi ha perso; in caso di pareggio, chi non aveva iniziato la partita precedente.

## Notifiche push (in futuro)
Niente lo impedisce: il documento ha già `turnUid` (di chi è il turno) e c'è `users/{uid}` dove salvare un token FCM. Serviranno una Cloud Function che scatta a ogni aggiornamento di `games/{id}` e il piano Blaze.
