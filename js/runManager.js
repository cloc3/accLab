// js/runManager.js
// ==========================================
// 1. VARIABILI DI STATO GLOBALI
// ==========================================
let sequenza = [];
let timerTimeout = null;
let ultimaMisuraValida = null; // Mantiene in memoria l'ultima run completata
let sorgenteSSE = null;
let idMisuraInModifica = null;
let btnNotaAttivo = null;
let firmaClientSSE = Math.random().toString(36).substring(2, 7);

// ==========================================
// 2. FUNZIONI UTILITY & NOTIFICHE
// ==========================================
function mostraErrore(testo) {
  if (cassettiera && cassettiera.messaggioErrore && cassettiera.boxErrore) {
    cassettiera.messaggioErrore.textContent = testo;
    cassettiera.boxErrore.classList.remove("hidden");
  } else {
    console.error(testo);
  }
}

function nascondiErrore() {
  if (cassettiera && cassettiera.boxErrore) {
    cassettiera.boxErrore.classList.add("hidden");
  }
}

function calcolaVelocita(spazio, tempoMs) {
  if (!tempoMs || tempoMs <= 0) return "0.00";
  const tempoS = tempoMs / 1000.0;
  const v = spazio / tempoS;
  return v;
}

function ripristinaPulsanteAvvio() {
  if (cassettiera && cassettiera.avvio) {
    cassettiera.avvio.textContent = "Run"; 
    cassettiera.avvio.style.backgroundColor = "";
    cassettiera.avvio.style.color = "";
  }
}

function downloadFile(contentUri, fileName) {
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", contentUri);
  downloadAnchor.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// ==========================================
// 3. CALCOLO E ACQUISIZIONE RUN
// ==========================================

function inviaDatoLiveData(misuraCompleta) {
  if (!scambioDati.sessioneAttiva) return;
  const payload = {
    ...misuraCompleta,
    session_id: scambioDati.sessioneAttiva,
    firmaSSE: firmaClientSSE
  };

  fetch('php/salvaLiveData.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Errore invio liveData:", err));
}

// Helper per inviare comandi seriali ad Arduino in sicurezza
function inviaComandoArduino(comandoStr) {
  if (typeof arduinoAttivo !== 'undefined' && arduinoAttivo && arduinoAttivo.device_.opened) {
    let encoder = new TextEncoder();
    arduinoAttivo.send(encoder.encode(comandoStr));
  }
}

function gestioneRitardo(ritardo, stato, L) {
  nascondiErrore();

  // Helper locale per aggiornare textContent e title (tooltip)
  const aggiornaCella = (elemento, valore, unitaMisura = "", isTempo = false) => {
    if (!elemento) return;

    if (valore !== undefined && valore !== null && valore !== "--" && !isNaN(valore)) {
      const suffisso = unitaMisura ? ` ${unitaMisura}` : "";

      // Se è un intervallo/tempo usiamo formattaTempo, altrimenti formattaMisura
      const valoreFormattato = isTempo
        ? formattaTempo(valore)
        : formattaMisura(valore);

      elemento.textContent = `${valoreFormattato}${suffisso}`;
      elemento.title = formattaTitleScientifico(valore, unitaMisura);
    } else {
      elemento.textContent = "--";
      elemento.removeAttribute("title");
    }
  };

  const elemTimeout = document.getElementById("timeOutSec");
  const timeoutMs = elemTimeout ? (parseInt(elemTimeout.value, 10) * 1000) : 4000;

  if (timerTimeout) clearTimeout(timerTimeout);
  timerTimeout = setTimeout(() => {
    if (sequenza.length > 0 && sequenza.length < 3) {
      mostraErrore(`Timeout (${timeoutMs / 1000}s): sequenza incompleta. Effettua un nuovo passaggio.`);
      sequenza = [];
      inviaComandoArduino("2"); // Spegne il LED anche su Timeout!
      ripristinaPulsanteAvvio();
    }
  }, timeoutMs);

  const elemStato = document.getElementById("statoIniziale");
  const primoStatoAtteso = (elemStato && elemStato.value === "1") ? "light" : "dark";

  if (sequenza.length === 0 && stato !== primoStatoAtteso) {
    mostraErrore(`Sequenza non valida: il primo passaggio deve essere ${primoStatoAtteso}.`);
    return;
  }

  sequenza.push({ rit: ritardo, stato: stato });

  const elemInput = document.getElementById("lenUnica") || (cassettiera ? cassettiera.lenUnica : null);
  let Lcm = elemInput ? (parseFloat(elemInput.value) || 10) : 10;
  if (L != undefined) Lcm = L;

  // --- PASSAGGIO 1 ---
  if (sequenza.length === 1) {
    const v1 = calcolaVelocita(Lcm, ritardo);

    aggiornaCella(cassettiera.valoreC1, ritardo, "ms", true);
    aggiornaCella(cassettiera.velC1, v1, "cm/s");
  }
  // --- PASSAGGIO 2 ---
  else if (sequenza.length === 2) {
    const vGap = calcolaVelocita(Lcm, ritardo);

    aggiornaCella(cassettiera.valoreGap, ritardo, "ms", true);
    aggiornaCella(cassettiera.velGap, vGap, "cm/s");
  }
  // --- PASSAGGIO 3 (COMPLETAMENTO) ---
  else if (sequenza.length === 3) {
    // SPEGNE L'EMETTITORE AD ESPERIMENTO COMPLETATO
    inviaComandoArduino("2");

    // 1. Calcoli cinematici in Float puri (senza formattazione)
    const v1 = calcolaVelocita(Lcm, sequenza[0].rit);
    const vGap = calcolaVelocita(Lcm, sequenza[1].rit);
    const v2 = calcolaVelocita(Lcm, sequenza[2].rit);

    const tempoTotaleMs = sequenza.reduce((acc, curr) => acc + curr.rit, 0);
    const vMedia = calcolaVelocita(Lcm * 3, tempoTotaleMs);

    let accData = { a12: 0, a23: 0, a13: 0, aMinQ: 0 };
    if (typeof calcolaAccelerazioniCinematiche === 'function') {
      accData = calcolaAccelerazioniCinematiche(sequenza, Lcm);
    }

    // 2. Renderizzazioni visive nella cassettiera (con formattazione + tooltip)
    aggiornaCella(cassettiera.valoreC2, sequenza[2].rit, "ms", true);
    aggiornaCella(cassettiera.velC2, v2, "cm/s");
    aggiornaCella(cassettiera.valoreTotale, tempoTotaleMs, "ms", true);
    aggiornaCella(cassettiera.velMedia, vMedia, "cm/s");

    aggiornaCella(cassettiera.acc12, accData.a12, "cm/s²");
    aggiornaCella(cassettiera.acc23, accData.a23, "cm/s²");
    aggiornaCella(cassettiera.acc13, accData.a13, "cm/s²");
    aggiornaCella(cassettiera.accMinQ, accData.aMinQ, "cm/s²");

    // 3. Reset dei timer e cambi stato UI
    clearTimeout(timerTimeout);

    if (typeof streamHandler !== 'undefined') {
      streamHandler = voidHandler;
    }
    ripristinaPulsanteAvvio();

    if (cassettiera && typeof cassettiera.mostraVistaLive === 'function') {
      cassettiera.mostraVistaLive();
    }

    if (cassettiera && typeof cassettiera.mostraBtnSalva === 'function') {
      cassettiera.mostraBtnSalva();
    }

    if (cassettiera && cassettiera.log) {
      cassettiera.log.textContent = "Misura completata. Pronta per il salvataggio.";
    }

    // 4. Salvataggio nello store/stato: SOLO float numerici
    ultimaMisuraValida = {
      dt1: sequenza[0].rit,
      dt_gap: sequenza[1].rit,
      dt2: sequenza[2].rit,
      dt_tot: tempoTotaleMs,
      spazio_ds: Lcm,
      v1: parseFloat(v1) || 0,
      v_gap: parseFloat(vGap) || 0,
      v2: parseFloat(v2) || 0,
      v_media: parseFloat(vMedia) || 0,
      a12: parseFloat(accData.a12) || 0,
      a23: parseFloat(accData.a23) || 0,
      a13: parseFloat(accData.a13) || 0,
      a_min_quad: parseFloat(accData.aMinQ) || 0
    };

    inviaDatoLiveData(ultimaMisuraValida);

    if (scambioDati.sessioneAttiva) {
      if (cassettiera && typeof cassettiera.mostraBtnEsci === 'function') {
        cassettiera.mostraBtnEsci();
      }
    }

    sequenza = [];
  }
}

function resetMisura() {
  sequenza = [];
  ultimaMisuraValida = null;
  if (timerTimeout) clearTimeout(timerTimeout);

  if (cassettiera.valoreC1) cassettiera.valoreC1.textContent = "--";
  if (cassettiera.valoreGap) cassettiera.valoreGap.textContent = "--";
  if (cassettiera.valoreC2) cassettiera.valoreC2.textContent = "--";
  if (cassettiera.valoreTotale) cassettiera.valoreTotale.textContent = "--";

  if (cassettiera.velC1) cassettiera.velC1.textContent = "--";
  if (cassettiera.velGap) cassettiera.velGap.textContent = "--";
  if (cassettiera.velC2) cassettiera.velC2.textContent = "--";
  if (cassettiera.velMedia) cassettiera.velMedia.textContent = "--";

  if (cassettiera.acc12) cassettiera.acc12.textContent = "--";
  if (cassettiera.acc23) cassettiera.acc23.textContent = "--";
  if (cassettiera.acc13) cassettiera.acc13.textContent = "--";
  if (cassettiera.accMinQ) cassettiera.accMinQ.textContent = "--";

  nascondiErrore();
  ripristinaPulsanteAvvio();

  if (!scambioDati.sessioneAttiva && cassettiera && typeof cassettiera.nascondiBtnSalva === 'function') {
    cassettiera.nascondiBtnSalva();
  }
  if (cassettiera && typeof cassettiera.impostaModalitaSessione === 'function') {
    cassettiera.impostaModalitaSessione();
  }
}

// ==========================================
// 4. GESTIONE SALVATAGGIO E SESSIONE
// ==========================================

/**
 * Gestisce la validazione e l'avvio del salvataggio di una run.
 * Verifica la presenza della misurazione e determina la sessione target
 * consultando lo store centralizzato ScambioDati prima di procedere.
 */
async function gestisciSalvaRun() {
  // 1. Controllo pre-condizione: presenza di una misura valida
  if (!ultimaMisuraValida) {
    mostraErrore("Nessuna misura disponibile da salvare. Effettua prima una prova.");
    return;
  }

  const inputNome = document.getElementById("nomeSessione");
  const selectSessione = document.getElementById("selectSessioni");

  let nomeTarget = "";

  // 2. Determinazione del nome della sessione (Priorità: ScambioDati > Input Testo > Select Dropdown)
  if (scambioDati && scambioDati.sessioneAttiva) {
    nomeTarget = scambioDati.sessioneAttiva;
  } else if (inputNome && inputNome.value.trim() !== "") {
    nomeTarget = inputNome.value.trim().replace(/\s+/g, '_');
  } else if (selectSessione && selectSessione.value && selectSessione.value !== "") {
    nomeTarget = selectSessione.value.trim();
  }

  // 3. Validazione del nome sessione
  if (!nomeTarget) {
    mostraErrore("Inserisci un nome sessione (o nick) per poter salvare le misurazioni.");
    if (inputNome) inputNome.focus();
    return;
  }

  // 4. Se la sessione è già stata confermata localmente ed è corrispondente, procediamo direttamente
  if (scambioDati.sessioneAttiva === true && scambioDati.sessioneAttiva === nomeTarget) {
    eseguiSalvaRunEffettivo(nomeTarget);
    return;
  }

  // 5. Verifica asincrona di esistenza sessione sul server
  try {
    const res = await fetch(`php/verificaSessione.php?user=${encodeURIComponent(nomeTarget)}`);
    const data = await res.json();

    if (data.status === 'ok' && data.exists) {
      // La sessione esiste già a DB: chiediamo conferma o rinominazione
      const nuovoNome = prompt(
        `🚫 ATTENZIONE: La sessione "${nomeTarget}" esiste già nel database!\n\n` +
        `Inserisci un nuovo nick/nome sessione per procedere (oppure accetta quello suggerito):`,
        nomeTarget
      );

      // Annullamento da parte dell'utente
      if (!nuovoNome || nuovoNome.trim() === "") {
        if (cassettiera && cassettiera.log) {
          cassettiera.log.textContent = "❌ Salvataggio ANNULLATO: nome sessione non fornito.";
        }
        return;
      }

      const nomePulito = nuovoNome.trim().replace(/\s+/g, '_');

      // Aggiorniamo l'interfaccia e la sorgente dati unica
      if (inputNome) inputNome.value = nomePulito;
      if (scambioDati) scambioDati.sessioneAttiva = nomePulito;

      scambioDati.isSessioneConfermata = true;
      eseguiSalvaRunEffettivo(nomePulito);

    } else {
      // La sessione non esiste ancora: possiamo proceedere ed registrarla
      if (scambioDati) scambioDati.sessioneAttiva = nomeTarget;

      eseguiSalvaRunEffettivo(nomeTarget);
    }

  } catch (err) {
    console.error("[gestisciSalvaRun] Errore verifica sessione:", err);
    mostraErrore("Impossibile verificare la sessione sul server.");
  }
}

/**
 * Esegue la richiesta Fetch di salvataggio della misura sul database
 * e aggiorna lo stato locale centrale (ScambioDati) e la vista Analisi.
 * 
 * @param {string} idSessione - L'identificatore della sessione target.
 */

async function eseguiSalvaRunEffettivo(idSessione) {
  // 1. Allineiamo lo stato centralizzato della sessione
  if (scambioDati) {
    scambioDati.sessioneAttiva = idSessione;
  }

  const payload = {
    ...ultimaMisuraValida,
    session_id: idSessione,
    firmaSSE: firmaClientSSE
  };

  try {
    const res = await fetch('php/salvaMisura.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.status === 'ok') {

      // 2. Costruzione del record completo con l'ID e il run_numero ufficiali restituiti dal PHP
      const nuovaRunCompleta = {
        ...payload,
        id: data.id,
        esclusa: 0
      };

      // 3. Aggiornamento dello store in memoria privato
      if (scambioDati) {
        scambioDati.upsertMisuraLocale(nuovaRunCompleta);
      }

      // 4. Aggiornamento vista Analisi: append della singola riga e ricalcolo statistico
      if (typeof renderizzaRigaMisura === 'function') {
        renderizzaRigaMisura(nuovaRunCompleta);
      }
      if (typeof aggiornaSintesiStatistica === 'function' && scambioDati) {
        aggiornaSintesiStatistica(scambioDati.datasetSessione);
      }

      // 5. Reset dello stato della misura temporanea
      ultimaMisuraValida = null;

      if (cassettiera && cassettiera.btnSalvaRun) {
        cassettiera.btnSalvaRun.classList.add("hidden");
      }

      // 6. Aggiornamento elementi DOM della sessione
      const boxInput = document.getElementById("boxInputSessione");
      const boxAttiva = document.getElementById("boxSessioneAttiva");
      const nomeFisso = document.getElementById("nomeSessioneFisso");

      if (boxInput) boxInput.classList.add("hidden");
      if (boxAttiva) boxAttiva.classList.remove("hidden");
      if (nomeFisso) nomeFisso.textContent = idSessione;

      // 7. Aggiornamento URL di navigazione e QR Code
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('user', idSessione);
      window.history.replaceState({}, '', currentUrl.toString());

      if (typeof generaQRCodeSessione === 'function') {
        generaQRCodeSessione(idSessione);
      }

      // 8. Aggiornamento UI della cassettiera
      if (cassettiera && typeof cassettiera.mostraBtnEsci === 'function') {
        cassettiera.mostraBtnEsci();
      }

    } else {
      mostraErrore("Errore durante il salvataggio: " + (data.message || "Risposta server non valida"));
    }

  } catch (err) {
    mostraErrore("Errore di connessione durante il salvataggio.");
    console.error("[eseguiSalvaRunEffettivo] Errore:", err);
  }
}

function calcolaIdSessione() {
  const inputNome = document.getElementById("nomeSessione");
  if (inputNome && inputNome.value.trim() !== "") {
    return inputNome.value.trim().replace(/\s+/g, '_');
  }
  return "";
}

function esciSessione() {
  fermaStreamLive();
  window.location.href = window.location.origin + window.location.pathname;
}

function generaQRCodeSessione(nomeSessione) {
  const container = document.getElementById("qrCodeContainer");
  const linkUrl = document.getElementById("urlSessioneTesto");
  if (!container) return;

  container.innerHTML = "";
  if (linkUrl) {
    linkUrl.textContent = "";
    linkUrl.removeAttribute("href");
  }

  const urlSessione = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(nomeSessione)}`;

  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: urlSessione,
      width: 128,
      height: 128,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
  }

  if (linkUrl) {
    linkUrl.textContent = urlSessione;
    linkUrl.href = urlSessione;
  }
}

async function controllaSessioneDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const nomeSessione = params.get('user');
  let sessionId = null;

  try {
    if (nomeSessione) {
      const res = await fetch(`php/verificaSessione.php?user=${encodeURIComponent(nomeSessione)}`);
      const data = await res.json();

      if (data.status === 'ok' && data.exists) {
        sessionId = data.session_id;

        // 1. Assegniamo la sessione al Data Store centrale
        scambioDati.sessioneAttiva = sessionId;

        // 2. Pre-carichiamo subito l'intero stato della sessione (misure, parametri, colori)
        await scambioDati.caricaDatiSessione(sessionId);

        // 3. Notifichiamo la UI e lo stream SSE
        if (cassettiera) cassettiera.impostaModalitaSessione();
        if (typeof avviaStreamLive === 'function') avviaStreamLive(sessionId);

        // 4. GENERAZIONE QR CODE ALL'AVVIO DA URL

        const boxInput = document.getElementById("boxInputSessione");
        const boxAttiva = document.getElementById("boxSessioneAttiva");
        const nomeFisso = document.getElementById("nomeSessioneFisso");

        if (boxInput) boxInput.classList.add("hidden");
        if (boxAttiva) boxAttiva.classList.remove("hidden");
        if (nomeFisso) nomeFisso.textContent = sessionId;

        if (typeof generaQRCodeSessione === 'function') {
          generaQRCodeSessione(sessionId);
        }
      }
    }
  } catch (err) {
    console.error("[controllaSessioneDaUrl] Errore durante la verifica/caricamento della sessione:", err);
  } finally {
    // Rilasciamo l'evento personalizzato per sbloccare l'eventuale test virtuale
    window.dispatchEvent(new CustomEvent('sessionePronta', { detail: { sessionId } }));

    // Restituiamo il sessionId a chi ha fatto .then() in main.js
    return sessionId;
  }
}

// ==========================================
// 5. RENDERING E CARICAMENTO TABELLA
// ==========================================

function popolaTabellaAnalisi(misure = scambioDati.datasetSessione, idsSelezionati = []) {
  const corpoTabella = cassettiera?.corpoTabellaSessione;
  if (!corpoTabella) return;

  corpoTabella.innerHTML = "";

  if (!misure || misure.length === 0) {
    corpoTabella.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 16px; opacity: 0.6; text-align: center;">
          Nessun dato o nessuna misura presente per la sessione attiva.
        </td>
      </tr>`;

    if (typeof aggiornaSintesiStatistica === 'function') {
      aggiornaSintesiStatistica([]);
    }
    return;
  }

  // 1. Aggiorna il blocco di sintesi statistica
  if (typeof aggiornaSintesiStatistica === 'function') {
    aggiornaSintesiStatistica(misure);
  }

  // 2. Calcolo scarti σ per il rendering dei badge
  const misureValide = misure.filter(m => parseInt(m.esclusa, 10) !== 1);
  const N = misureValide.length;

  let aMediaG = 0;
  let sigmaA = 0;

  if (N > 0) {
    const sommaA = misureValide.reduce((acc, curr) => acc + parseFloat(curr.a_min_quad || curr.a13 || 0), 0);
    aMediaG = sommaA / N;

    const varianza = misureValide.reduce((acc, curr) => {
      const aValCurr = parseFloat(curr.a_min_quad || curr.a13 || 0);
      const diff = aValCurr - aMediaG;
      return acc + (diff * diff);
    }, 0) / N;

    sigmaA = Math.sqrt(varianza);
  }

  // 3. Renderizza le righe
  misure.forEach((run) => {
    renderizzaRigaMisura(run, idsSelezionati, N, aMediaG, sigmaA);
  });

  // 4. Allinea lo stato del master checkbox
  const chkTutti = document.getElementById('chkSelezionaTutti');
  if (chkTutti) {
    const totali = document.querySelectorAll('.chk-run').length;
    const spuntati = document.querySelectorAll('.chk-run:checked').length;
    chkTutti.checked = (totali > 0 && totali === spuntati);
  }
}

function calcolaProssimoRunNumber() {
  const dataset = scambioDati.datasetSessione;

  if (!dataset || dataset.length === 0) {
    return 1;
  }

  // Estrae tutti i run_number validi convertendoli in numero
  const runNumbers = dataset
    .map(m => parseInt(m.run_numero, 10))
    .filter(n => !isNaN(n));

  if (runNumbers.length === 0) {
    return 1;
  }

  // Trova il valore massimo e somma 1
  return Math.max(...runNumbers) + 1;
}

function renderizzaRigaMisura(run, idsSelezionati = [], N = 0, aMediaG = 0, sigmaA = 0) {
  const corpoTabella = cassettiera.corpoTabellaSessione;
  if (!corpoTabella) return;

  const idRun = parseInt(run.id, 10);
  const isEsclusa = parseInt(run.esclusa, 10) === 1;
  const aVal = parseFloat(run.a_min_quad || run.a13 || 0);
  const isChecked = idsSelezionati.includes(idRun) ? 'checked' : '';

  let stileScarto = "";
  let tagScarto = "";

  if (!isEsclusa && N >= 2 && sigmaA > 0.0001) {
    const scartoAbs = Math.abs(aVal - aMediaG);
    const kSigma = scartoAbs / sigmaA;

    if (kSigma > 3) {
      stileScarto = "background-color: rgba(255, 82, 82, 0.2);";
      tagScarto = ` <span class="badge" style="color:#ff5252; font-weight:bold; cursor:help;" title="Scarto dalla media: ${scartoAbs.toFixed(2)} m/s² (> 3σ = ${ (3*sigmaA).toFixed(2) })">⚠️ >3σ</span>`;
    } else if (kSigma > 2) {
      stileScarto = "background-color: rgba(255, 183, 77, 0.15);";
      tagScarto = ` <span class="badge" style="color:#ffb74d; cursor:help;" title="Scarto dalla media: ${scartoAbs.toFixed(2)} m/s² (> 2σ = ${ (2*sigmaA).toFixed(2) })">⚡ >2σ</span>`;
    }
  }

  const stileStato = isEsclusa
    ? 'opacity: 0.45; background-color: rgba(255,0,0,0.05);'
    : stileScarto;

  const haNota = run.note && run.note.trim() !== '';
  let testoNotaSanificato = 'Aggiungi / Modifica nota';
  if (haNota) {
    testoNotaSanificato = run.note.replaceAll('"', '&quot;');
  }

  const rigaTabellaSessione = document.createElement("tr");
  rigaTabellaSessione.id = run.id;
  rigaTabellaSessione.style = stileStato;

  // 1. Checkbox
  const td_checkBox = document.createElement("td");
  td_checkBox.style = "text-align: center";
  const input_checkBox = document.createElement("input");
  input_checkBox.type = "checkbox";
  input_checkBox.className = "chk-run";
  input_checkBox.value = run.id;
  input_checkBox.id = "input_checkBox-"+run.id;
  if (isChecked) input_checkBox.checked = true;
  td_checkBox.appendChild(input_checkBox);
  rigaTabellaSessione.appendChild(td_checkBox);

  // 2. Numero Run
  const td_run_number = document.createElement("td");
  td_run_number.style = "font-weight:bold;";
  if (run.run_numero === undefined) {
    contenutoCellaRun_numero = "#" + calcolaProssimoRunNumber();
  } else  {
    contenutoCellaRun_numero = "#" + run.run_numero;
  }
  td_run_number.textContent = contenutoCellaRun_numero;
  rigaTabellaSessione.appendChild(td_run_number);

  // 3. Tempi e Velocità
  let cellaValore = document.createElement("td");
  cellaValore.textContent = formattaTempo(run.dt1);
  cellaValore.title = formattaTitleScientifico(run.dt1);
  rigaTabellaSessione.appendChild(cellaValore);

  cellaValore = document.createElement("td");
  cellaValore.textContent = formattaTempo(run.dt_gap);
  cellaValore.title = formattaTitleScientifico(run.dt_gap);
  rigaTabellaSessione.appendChild(cellaValore);

  cellaValore = document.createElement("td");
  cellaValore.textContent = formattaTempo(run.dt2);
  cellaValore.title = formattaTitleScientifico(run.dt2);
  rigaTabellaSessione.appendChild(cellaValore);

  cellaValore = document.createElement("td");
  cellaValore.textContent = formattaMisura(run.v_media);
  cellaValore.title = formattaTitleScientifico(run.v_media);
  rigaTabellaSessione.appendChild(cellaValore);

  cellaValore = document.createElement("td");
  cellaValore.textContent = formattaMisura(run.a_min_quad);
  cellaValore.title = formattaTitleScientifico(run.a_min_quad);
  rigaTabellaSessione.appendChild(cellaValore);

  // 4. Azioni (Note + Dettagli)
  const tdCelleAzioni = document.createElement("td");
  tdCelleAzioni.className = "celle-azioni";

  const btnNota = document.createElement("button");
  btnNota.type = "button";
  btnNota.classList.add("btn-icona");
  if (haNota) btnNota.classList.add("has-note");
  btnNota.setAttribute("onclick", `apriModalNote(${run.id}, this)`);
  btnNota.title = testoNotaSanificato;
  btnNota.id = `nota-${run.id}`;
  btnNota.textContent = "📝";
  btnNota.style = "margin-right:1em";
  tdCelleAzioni.appendChild(btnNota);

  const btnDettagli = document.createElement("button");
  btnDettagli.type = "button";
  btnDettagli.setAttribute("onclick", `apriModalDettagli(${run.id}, this)`);
  btnDettagli.title = "Visualizza parametri avanzati";
  btnDettagli.textContent = "🔍";
  tdCelleAzioni.appendChild(btnDettagli);

  rigaTabellaSessione.appendChild(tdCelleAzioni);

  corpoTabella.appendChild(rigaTabellaSessione);
}

// ==========================================
// 6. GESTIONE RUN (TOGGLE / ELIMINA / GRUPPO)
// ==========================================

function eliminaRun(idRun) {
  if (!confirm("Sei sicuro di voler eliminare definitivamente questa misura?")) return;

  fetch('php/gestisciRun.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azione: 'rimuovi_dati', id: idRun })
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'ok') {
        // 1. Aggiorna lo store locale
        if (scambioDati) {
          scambioDati.rimuoviMisuraLocale(idRun);
        }
        scambioDati.datasetSessione = scambioDati.datasetSessione.filter(m => parseInt(m.id, 10) !== parseInt(idRun, 10));

        // 2. Aggiorna la vista SENZA fare fetch
        const datiAggiornati = scambioDati?.datasetSessione;
        popolaTabellaAnalisi(datiAggiornati);
      } else {
        mostraErrore("Impossibile eliminare la run: " + data.message);
      }
    })
    .catch(err => console.error("Errore nell'eliminazione della run:", err));
}

function toggleSelezionaTutti(master) {
  const checkboxes = document.querySelectorAll('#corpoTabellaSessione tr td input[type="checkbox"]');
  checkboxes.forEach(chk => chk.checked = master.checked);
}

function gestisciAzioniGruppo(tipoAzione, evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }

  const caselleSpuntate = document.querySelectorAll('#corpoTabellaSessione tr td input[type="checkbox"]:checked');
  const selezionati = Array.from(caselleSpuntate)
    .map(chk => parseInt(chk.value, 10))
    .filter(id => !isNaN(id) && id > 0);

  if (selezionati.length === 0) {
    alert("Seleziona almeno una misura spuntando le caselle a sinistra prima di eseguire un'azione.");
    return;
  }

  // Funzione che esegue la fetch inviando la richiesta al server
  const eseguiAzione = () => {
    fetch('php/gestisciRun.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        azione: tipoAzione,
        ids: selezionati,
        session_id: scambioDati.sessioneAttiva
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'ok') {
          const idsDaMantenere = (tipoAzione === 'rimuovi_dati') ? [] : selezionati;

          // Aggiornamento locale per eliminazione
          if (tipoAzione === 'rimuovi_dati') {
            selezionati.forEach(id => {
              if (scambioDati) scambioDati.rimuoviMisuraLocale(id);
            });
          }

          // Refresh grafico immediato senza fetch
          const datiAggiornati = scambioDati?.datasetSessione;
          popolaTabellaAnalisi(datiAggiornati, idsDaMantenere);
        } else {
          alert("Errore dal server: " + (data.message || "Operazione fallita"));
        }
      })
      .catch(err => {
        console.error("Errore Fetch:", err);
        alert("Errore di comunicazione con il server.");
      });
  };
  if (tipoAzione === 'rimuovi_dati') {
    apriConfermaCustom(
      `Sei sicuro di voler eliminare DEFINITIVAMENTE ${selezionati.length} misure selezionate?`,
      eseguiAzione
    );
  } else {
    eseguiAzione();
  }
}

function apriConfermaCustom(messaggio, callbackConferma) {
  // Se hai già un modale HTML nel progetto usiamo quello,
  // altrimenti ne crea uno al volo assolutamente non bloccante per il Main Thread
  let modal = document.getElementById('modalConfermaCustom');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalConfermaCustom';
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999;";
    modal.innerHTML = `
      <div style="background: var(--bg-card, #111827); color: #fff; padding: 20px; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
        <p id="msgConfermaCustom" style="margin-bottom: 20px;"></p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="btnAnnullaCustom" class="btnSmall" style="background:#555; color:#fff;">Annulla</button>
          <button id="btnOkCustom" class="btnSmall" style="background:#ff5252; color:#fff;">Conferma</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('msgConfermaCustom').textContent = messaggio;
  modal.style.display = 'flex';

  const btnOk = document.getElementById('btnOkCustom');
  const btnAnnulla = document.getElementById('btnAnnullaCustom');

  // Pulizia vecchi listener
  const nuovoOk = btnOk.cloneNode(true);
  const nuovoAnnulla = btnAnnulla.cloneNode(true);
  btnOk.parentNode.replaceChild(nuovoOk, btnOk);
  btnAnnulla.parentNode.replaceChild(nuovoAnnulla, btnAnnulla);

  nuovoOk.addEventListener('click', () => {
    modal.style.display = 'none';
    callbackConferma();
  });

  nuovoAnnulla.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

// ==========================================
// 7. IMPORT / EXPORT E CONFIGURAZIONE
// ==========================================
function esportaDatiJSON() {
  const idSessione = scambioDati.sessioneAttiva;
  if (!idSessione) {
    mostraErrore("Nessuna sessione attiva da esportare.");
    return;
  }

  fetch(`php/caricaSessione.php?sessione=${encodeURIComponent(idSessione)}`)
    .then(res => res.json())
    .then(res => {
      if (res.status !== 'ok') {
        mostraErrore("Errore nel recupero dati per export: " + res.message);
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
      downloadFile(dataStr, `${idSessione}_export.json`);
    })
    .catch(err => mostraErrore("Errore di rete durante l'esportazione JSON."));
}

function esportaDatiCSV() {
  const idSessione = scambioDati.sessioneAttiva;
  if (!idSessione) {
    mostraErrore("Nessuna sessione attiva da esportare.");
    return;
  }

  fetch(`php/caricaSessione.php?sessione=${encodeURIComponent(idSessione)}`)
    .then(res => res.json())
    .then(res => {
      if (res.status !== 'ok' || !res.misure || res.misure.length === 0) {
        mostraErrore("Nessun dato presente nella sessione da esportare in CSV.");
        return;
      }

      const misure = res.misure;
      const intestazioni = Object.keys(misure[0]);

      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += intestazioni.join(",") + "\n";

      misure.forEach(row => {
        const riga = intestazioni.map(header => {
          let val = row[header] === null ? "" : row[header];
          val = String(val);

          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            const regexVirgolette = /"/g;
            val = `"${val.replace(regexVirgolette, '""')}"`;
          }
          return val;
        }).join(",");
        csvContent += riga + "\n";
      });

      downloadFile(csvContent, `${idSessione}_export.csv`);
    })
    .catch(err => mostraErrore("Errore di rete durante l'esportazione CSV."));
}

function importaFileDati(event) {
  const file = event.target.files[0];
  if (!file) return;

  const chkAccoda = document.getElementById("chkImportAccoda");
  const chkParametri = document.getElementById("chkImportParametri");
  const chkColori = document.getElementById("chkImportColori");

  const accodaDati = chkAccoda ? chkAccoda.checked : false;
  const importaParametri = chkParametri ? chkParametri.checked : false;
  const importaColori = chkColori ? chkColori.checked : false;

  if (!accodaDati) {
    const conferma = confirm("Attenzione: l'opzione 'Accoda i nuovi dati' non è selezionata.\nI dati correnti della sessione verranno cancellati e sovrascritti.\n\nVuoi continuare?");
    if (!conferma) {
      event.target.value = '';
      return;
    }
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const contenuto = e.target.result;
      const dati = JSON.parse(contenuto);

      if (importaParametri) {
        const p = dati.parametri || dati.config || {};
        const elemLen = document.getElementById("lenUnica");
        const elemTimeout = document.getElementById("timeOutSec");
        const elemStato = document.getElementById("statoIniziale");

        const valLen = p.spazio_ds ?? p.lenUnica;
        const valTimeout = p.timeout_sec ?? p.timeOutSec;
        const valStato = p.stato_iniziale ?? p.statoIniziale;

        if (elemLen && valLen !== undefined) elemLen.value = valLen;
        if (elemTimeout && valTimeout !== undefined) elemTimeout.value = valTimeout;
        if (elemStato && valStato !== undefined) elemStato.value = valStato;

        if (typeof salvaConfigurazioneCorrente === 'function') {
          salvaConfigurazioneCorrente("parametri");
        }
      }

      if (importaColori) {
        const c = dati.colori || dati.config || {};

        const elemSfondo = document.getElementById("colorSfondo");
        const elemHeader = document.getElementById("colorHeader");
        const elemCard = document.getElementById("colorCard");

        if (elemSfondo && c.bg_pagina) {
          elemSfondo.value = c.bg_pagina;
          document.documentElement.style.setProperty('--bg-pagina', c.bg_pagina);
        }
        if (elemHeader && c.bg_header) {
          elemHeader.value = c.bg_header;
          document.documentElement.style.setProperty('--bg-header', c.bg_header);
        }
        if (elemCard && c.bg_card) {
          elemCard.value = c.bg_card;
          document.documentElement.style.setProperty('--bg-card', c.bg_card);
        }

        if (typeof salvaConfigurazioneCorrente === 'function') {
          salvaConfigurazioneCorrente("colori");
        }
      }

      let nuoveMisure = dati.misure || (Array.isArray(dati) ? dati : []);

      if (scambioDati.sessioneAttiva) {
        nuoveMisure = nuoveMisure.map(m => ({
          ...m,
          session_id: scambioDati.sessioneAttiva
        }));
      }

      if (!accodaDati && scambioDati.sessioneAttiva) {
        const caselleSpuntate = document.querySelectorAll('#corpoTabellaSessione tr td input[type="checkbox"]');
        let idsDaEliminare = Array.from(caselleSpuntate)
          .map(chk => parseInt(chk.value, 10))
          .filter(id => !isNaN(id) && id > 0);

        if (idsDaEliminare.length === 0 && Array.isArray(scambioDati.datasetSessione)) {
          idsDaEliminare = scambioDati.datasetSessione
            .map(m => parseInt(m.id, 10))
            .filter(id => !isNaN(id) && id > 0);
        }

        if (idsDaEliminare.length > 0) {
          fetch('php/gestisciRun.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ azione: 'rimuovi_dati', ids: idsDaEliminare })
          })
            .then(res => res.json())
            .then(data => {
              if (data && data.status === 'ok') {
                scambioDati.datasetSessione = nuoveMisure;
                inviaMisureImportateAlServer(nuoveMisure);
              } else {
                mostraErrore("Impossibile svuotare i vecchi dati: " + (data.message || "Operazione fallita"));
              }
            })
            .catch(err => {
              console.error("Errore Fetch eliminazione preventiva:", err);
              mostraErrore("Errore di comunicazione durante la cancellazione dei dati precedenti.");
            });
        } else {
          scambioDati.datasetSessione = nuoveMisure;
          inviaMisureImportateAlServer(nuoveMisure);
        }

      } else {
        scambioDati.datasetSessione = (scambioDati.datasetSessione || []).concat(nuoveMisure);
        inviaMisureImportateAlServer(nuoveMisure);
      }

    } catch (err) {
      console.error("Errore nel parsing o nell'applicazione dei dati:", err);
      alert("Errore nell'importazione dei dati: verificare il formato del file.");
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

async function inviaMisureImportateAlServer(misure) {
  if (!scambioDati.sessioneAttiva) {
    mostraErrore("Attiva o crea prima una sessione di destinazione per importare i dati.");
    return;
  }

  if (!misure || misure.length === 0) return;

  let salvate = 0;
  const totale = misure.length;

  for (const m of misure) {
    const payload = {
      ...m,
      session_id: scambioDati.sessioneAttiva
    };

    try {
      const response = await fetch('php/salvaMisura.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data && data.status === 'ok') {
        salvate++;

        // Se il server restituisce l'ID reale della nuova riga nel DB, aggiorniamo il record in memoria
        const rigaInserita = { ...m, id: data.id || m.id, session_id: scambioDati.sessioneAttiva };

        if (scambioDati) {
          scambioDati.upsertMisuraLocale(rigaInserita);
        }
      } else {
        console.warn("Avviso nell'importazione di un record:", data.message);
      }
    } catch (err) {
      console.error("Errore di rete nell'importazione della riga:", err);
    }
  }

  if (cassettiera && cassettiera.log) {
    cassettiera.log.textContent = `Importazione completata: ${salvate} su ${totale} misure caricate in "${scambioDati.sessioneAttiva}".`;
  }

  // RIPRISTINO LOCALE SENZA FETCH:
  // Usa il dataset locale aggiornato (o quello presente in ScambioDati)
  const datiAggiornati = scambioDati?.datasetSessione || window.datasetSessione;
  popolaTabellaAnalisi(datiAggiornati);
}

function salvaConfigurazioneCorrente(tipoNotifica = "generica") {
  if (!scambioDati.sessioneAttiva) {
    mostraErrore("Nessuna sessione attiva su cui salvare la configurazione.");
    return;
  }

  const elemDs = document.getElementById("lenUnica") || (cassettiera ? cassettiera.lenUnica : null);
  const elemTimeout = document.getElementById("timeOutSec");
  const elemStato = document.getElementById("statoIniziale");

  const cSfondo = document.getElementById("colorSfondo");
  const cHeader = document.getElementById("colorHeader");
  const cCard = document.getElementById("colorCard");

  const payload = {
    session_id: scambioDati.sessioneAttiva,
    spazio_ds: elemDs ? parseFloat(elemDs.value) : 10,
    timeout_sec: elemTimeout ? parseInt(elemTimeout.value, 10) : 4,
    stato_iniziale: elemStato ? parseInt(elemStato.value, 10) : 0,
    bg_pagina: cSfondo ? cSfondo.value : "#ffffe0",
    bg_header: cHeader ? cHeader.value : "#ffe4b5",
    bg_card: cCard ? cCard.value : "#111827"
  };

  fetch('php/salvaConfig.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'ok') {
        const etichetta = tipoNotifica === "parametri" ? "Parametri salvati" : "Colori salvati";
        if (cassettiera && cassettiera.log) {
          cassettiera.log.textContent = `✅ ${etichetta} correttamente per la sessione "${scambioDati.sessioneAttiva}".`;
        }
      } else {
        mostraErrore("Errore durante il salvataggio della configurazione: " + data.message);
      }
    })
    .catch(err => {
      console.error("Errore salvataggio config:", err);
      mostraErrore("Impossibile salvare la configurazione sul server.");
    });
}

function applicaConfigurazioneSalvata(cfg) {
  const elDs = document.getElementById("lenUnica") || (cassettiera ? cassettiera.lenUnica : null);
  const elTimeout = document.getElementById("timeOutSec");
  const elStato = document.getElementById("statoIniziale");

  if (elDs && cfg.spazio_ds) elDs.value = cfg.spazio_ds;
  if (elTimeout && cfg.timeout_sec) elTimeout.value = cfg.timeout_sec;
  if (elStato && cfg.stato_iniziale !== undefined && cfg.stato_iniziale !== null) {
    elStato.value = cfg.stato_iniziale;
  }

  const cSfondo = document.getElementById("colorSfondo");
  const cHeader = document.getElementById("colorHeader");
  const cCard = document.getElementById("colorCard");

  if (cSfondo && cfg.bg_pagina) {
    cSfondo.value = cfg.bg_pagina;
    document.documentElement.style.setProperty('--bg-pagina', cfg.bg_pagina);
  }
  if (cHeader && cfg.bg_header) {
    cHeader.value = cfg.bg_header;
    document.documentElement.style.setProperty('--bg-header', cfg.bg_header);
  }
  if (cCard && cfg.bg_card) {
    cCard.value = cfg.bg_card;
    document.documentElement.style.setProperty('--bg-card', cfg.bg_card);
  }
}

// ==========================================
// 8. MODALI NOTE E DETTAGLI
// ==========================================
function chiudiModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) modal.style.display = 'none';
}

function apriModalNote(runId, elementoBtn) {
  const idDb = parseInt(runId, 10);
  idMisuraInModifica = idDb;
  btnNotaAttivo = elementoBtn || (event ? event.currentTarget : null);

  const dataset = scambioDati.datasetSessione || [];
  const runSelezionata = dataset.find(item => parseInt(item.id, 10) === idDb);

  const elRunId = document.getElementById('modalNoteRunId');
  if (elRunId) {
    const numeroSequenziale = runSelezionata
      ? (runSelezionata.run_numero || runSelezionata.run_num)
      : idDb;
    elRunId.textContent = `#${numeroSequenziale}`;
  }

  const txtArea = document.getElementById('txtNotaMisura');
  if (txtArea) {
    txtArea.value = (runSelezionata && runSelezionata.note) ? runSelezionata.note : '';
  }

  const modal = document.getElementById('modalNote');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function salvaNotaMisura() {
  const idDb = idMisuraInModifica;
  const txtArea = document.getElementById('txtNotaMisura');
  const btnSalva = document.querySelector('#modalNote .btn-primario'); // Tasto salva della modal[cite: 2]

  if (!idDb || !txtArea) return;

  const testoNota = txtArea.value.trim();

  // Disabilita temporaneamente per evitare invii doppi
  if (btnSalva) btnSalva.disabled = true;

  fetch('php/gestisciRun.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      azione: 'modifica_nota',
      session_id: scambioDati.sessioneAttiva,
      id: idDb,
      note: testoNota
    })
  })
    .then(response => response.json())
    .then(res => { 
      if (res.status === 'ok') {
        // Successo: Chiudiamo la modal (il listener SSE si occuperà di aggiornare DOM e Store)
        chiudiModal('modalNote');
      } else {
        // Errore del backend: La modal RESTA APERTA per permettere di correggere/riprovare
        alert('Errore durante il salvataggio: ' + (res.message || 'Errore sconosciuto'));
      }
    })
    .catch(err => {
      console.error('Errore nella chiamata a gestisciRun.php:', err);
      alert('Errore di connessione al server durante il salvataggio della nota.');
    })
    .finally(() => {
      // Riabilita sempre il pulsante alla fine della chiamata
      if (btnSalva) btnSalva.disabled = false;
    });
}

function apriModalDettagli(idMisura) {
  const misura = scambioDati.datasetSessione?.find(m => m.id == idMisura);

  if (!misura) {
    mostraErrore("Impossibile trovare i dati per la misura selezionata.");
    return;
  }

  const elRunId = document.getElementById("modalDettaglioRunId");
  if (elRunId) {
    elRunId.textContent = `#${misura.run_numero ?? misura.id}`;
  }

  // 1. RECUPERO ACCELERAZIONE DI RIFERIMENTO (Media delle run non escluse)
  const aMisurata = parseFloat(misura.a_min_quad || misura.a13) || 0;

  // Filtra solo le misure valide appartenenti alla sessione attiva
  const misureValide = (scambioDati.datasetSessione || []).filter(m => parseInt(m.esclusa, 10) !== 1);
  const N = misureValide.length;

  // Calcola la media delle accelerazioni dai minimi quadrati della serie
  const sommaA = misureValide.reduce((acc, curr) => {
    return acc + parseFloat(curr.a_min_quad !== undefined ? curr.a_min_quad : (curr.a13 || 0));
  }, 0);

  const aRiferimento = N > 0 ? (sommaA / N) : aMisurata;

  // 2. CALCOLO SCARTI ED ERRORI RELATIVI ALLA MEDIA
  const errAssoluto = Math.abs(aMisurata - aRiferimento);
  const errRelativo = aRiferimento !== 0 ? ((errAssoluto / Math.abs(aRiferimento)) * 100) : 0;
  const errQuadratico = Math.pow(aMisurata - aRiferimento, 2);

  const errRelativoStr = `${errRelativo.toFixed(2)} %`;
  const errQuadraticoStr = errQuadratico.toFixed(6);

  // 3. RECUPERO LUNGHEZZA CARTELLINO (Ds)
  const lenUnicaInput = parseFloat(document.getElementById("lenUnica")?.value) || 10;

  const v1 = parseFloat(misura.v1) || 0;
  const dt1_sec = (parseFloat(misura.dt1) || 0) / 1000;
  const dsCalcolato = (v1 > 0 && dt1_sec > 0) ? (v1 * dt1_sec) : lenUnicaInput;

  // 4. GESTIONE NOTE
  const elPulsanteNota = document.querySelector(`#nota-${idMisura}`);
  const testoNota = elPulsanteNota?.getAttribute('title')?.trim() || "";

  const haNotaValida = testoNota !== "" && !testoNota.toLowerCase().includes("aggiungi / modifica nota");
  const htmlNote = haNotaValida ? `
    <div class="dettaglio-item full-width">
        <label>Note Utente:</label>
        <div class="nota-box">${testoNota}</div>
    </div>
  ` : "";

  // 5. GENERAZIONE CONTENUTO MODAL
  const corpoDettagli = document.getElementById("corpoDettagliMisura");
  if (corpoDettagli) {
    corpoDettagli.innerHTML = `
  <div class="dettaglio-item full-width" style="background: rgba(255,255,255,0.05); border-left: 3px solid #10b981;">
      <label>Spazio Δs (Lunghezza Cartellino):</label>
      <span title="${formattaTitleScientifico(dsCalcolato)}"><strong>${formattaMisura(dsCalcolato)}</strong> cm <small>(impostato: ${lenUnicaInput} cm)</small></span>
  </div>

  <div class="dettaglio-item">
      <label>Velocità v1:</label>
      <span title="${formattaTitleScientifico(misura.v1)}">${formattaMisura(misura.v1)} cm/s</span>
  </div>
  <div class="dettaglio-item">
      <label>Velocità v2:</label>
      <span title="${formattaTitleScientifico(misura.v2)}">${formattaMisura(misura.v2)} cm/s</span>
  </div>
  <div class="dettaglio-item">
      <label>Velocità v_gap (v3):</label>
      <span title="${formattaTitleScientifico(misura.v_gap)}">${formattaMisura(misura.v_gap)} cm/s</span>
  </div>
  <div class="dettaglio-item">
      <label>Velocità Media:</label>
      <span title="${formattaTitleScientifico(misura.v_media)}"><strong>${formattaMisura(misura.v_media)}</strong> cm/s</span>
  </div>

  <div class="dettaglio-item">
      <label>Acc. Misurata (aminQuad):</label>
      <span title="${formattaTitleScientifico(aMisurata)}"><strong>${formattaMisura(aMisurata)}</strong> cm/s²</span>
  </div>
  <div class="dettaglio-item">
      <label>Acc. Media Sessione (ā):</label>
      <span title="${formattaTitleScientifico(aRiferimento)}"><strong>${formattaMisura(aRiferimento)}</strong> cm/s²</span>
  </div>

  <div class="dettaglio-item">
      <label>Scarto Assoluto (|a - ā|):</label>
      <span title="${formattaTitleScientifico(errAssoluto)}"><strong>${formattaMisura(errAssoluto)}</strong> cm/s²</span>
  </div>
  <div class="dettaglio-item">
      <label>Scarto Relativo:</label>
      <span title="${formattaTitleScientifico(errRelativo)}"><strong>${formattaMisura(errRelativo)} %</strong></span>
  </div>
  <div class="dettaglio-item full-width">
      <label>Scarto Quadratico Dalla Media:</label>
      <span title="${formattaTitleScientifico(errQuadratico)}"><strong>${formattaMisura(errQuadratico)}</strong> (cm/s²)²</span>
  </div>

  ${htmlNote}
`;
  }

  const modal = document.getElementById("modalDettagli");
  if (modal) modal.style.display = "flex";
}

// ==========================================
// 9. STATISTICHE E INTERFACCIA
// ==========================================

function toggleFullscreenRisultati() {
  const colonna = document.getElementById('colonnaRisultati');
  const btn = document.getElementById('btnToggleFullscreenRisultati');
  const body = document.body;

  if (!colonna) return;

  const isFullscreen = colonna.classList.toggle('fullscreen-mode');
  body.classList.toggle('has-fullscreen-column', isFullscreen);

  if (btn) {
    btn.innerHTML = isFullscreen ? '🗗 Ripristina' : '⛶ Ingrandisci';
    btn.title = isFullscreen ? 'Ripristina vista normale' : 'Espandi a tutto schermo';
  }
}

function aggiornaSintesiStatistica(misure) {
  if (!misure || !Array.isArray(misure)) return;

  const misureValide = misure.filter(m => parseInt(m.esclusa, 10) !== 1);
  const N = misureValide.length;

  const elemN = document.getElementById("statN") || document.querySelector(".sintesi-statistica h3");
  if (elemN) elemN.textContent = `Sintesi Statistica (N = ${N})`;

  if (N === 0) {
    impostaValoriSintesi("--", "--", "--", "--");
    return;
  }

  const sommaV = misureValide.reduce((acc, curr) => acc + parseFloat(curr.v_media || 0), 0);
  const sommaA = misureValide.reduce((acc, curr) => {
    const valA = parseFloat(curr.a_min_quad !== undefined ? curr.a_min_quad : (curr.a13 || curr.a_media || 0));
    return acc + valA;
  }, 0);

  const vMediaG = sommaV / N;
  const aMediaG = sommaA / N;

  const varianza = misureValide.reduce((acc, curr) => {
    const valA = parseFloat(curr.a_min_quad !== undefined ? curr.a_min_quad : (curr.a13 || curr.a_media || 0));
    const diff = valA - aMediaG;
    return acc + (diff * diff);
  }, 0) / N;

  const sigmaA = Math.sqrt(varianza);
  const erroreRelativo = aMediaG !== 0 ? ((sigmaA / Math.abs(aMediaG)) * 100) : 0;

  impostaValoriSintesi(
    vMediaG,
    aMediaG,
    sigmaA,
    erroreRelativo
  );
}

function impostaValoriSintesi(vMedia, aMedia, sigmaA, errRelativo) {
  const elVMedia = document.getElementById("statVMedia") || document.getElementById("sintesiVMedia");
  const elAMedia = document.getElementById("statAMedia") || document.getElementById("sintesiAMedia");
  const elSigmaA = document.getElementById("statSigmaA") || document.getElementById("sintesiSigmaA");
  const elErrRel = document.getElementById("statSigmaARel") || document.getElementById("sintesiErrRelativo");

  // Velocità Media
  if (elVMedia) {
    if (vMedia !== "--" && vMedia !== null && vMedia !== undefined) {
      elVMedia.textContent = `${formattaMisura(vMedia)} cm/s`;
      elVMedia.title = formattaTitleScientifico(vMedia, "cm/s");
    } else {
      elVMedia.textContent = "--";
      elVMedia.removeAttribute("title");
    }
  }

  // Accelerazione Media
  if (elAMedia) {
    if (aMedia !== "--" && aMedia !== null && aMedia !== undefined) {
      elAMedia.textContent = `${formattaMisura(aMedia)} cm/s²`;
      elAMedia.title = formattaTitleScientifico(aMedia, "cm/s²");
    } else {
      elAMedia.textContent = "--";
      elAMedia.removeAttribute("title");
    }
  }

  // Deviazione Standard (Sigma A)
  if (elSigmaA) {
    if (sigmaA !== "--" && sigmaA !== null && sigmaA !== undefined) {
      elSigmaA.textContent = `± ${formattaMisura(sigmaA)} cm/s²`;
      elSigmaA.title = formattaTitleScientifico(sigmaA, "cm/s²");
    } else {
      elSigmaA.textContent = "--";
      elSigmaA.removeAttribute("title");
    }
  }

  // Errore Relativo (%)
  if (elErrRel) {
    if (errRelativo !== "--" && errRelativo !== null && errRelativo !== undefined && !isNaN(errRelativo)) {
      elErrRel.textContent = "("+`${formattaMisura(errRelativo)} %`+")";
      elErrRel.title = formattaTitleScientifico(errRelativo, "%");
    } else {
      elErrRel.textContent = "--";
      elErrRel.removeAttribute("title");
    }
  }
}

// ==========================================
// 10. SIMULAZIONE E STREAM LIVE (SSE)
// ==========================================

function simulaRunVirtuale() {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('test')) return;

  // 1. Estrazione parametri da URL
  let dt1 = parseFloat(urlParams.get('dt1')) || 1401.53;
  let dtGap = parseFloat(urlParams.get('dt_gap')) || 1186.38;
  let dt2 = parseFloat(urlParams.get('dt2')) || 1048.56;
  let Lcm = parseInt(urlParams.get('L')) || parseInt(urlParams.get('Lcm')) || 10;

  const noDev = urlParams.has('nodev');
  let sigma = parseFloat(urlParams.get('sigma'));
  if (isNaN(sigma)) sigma = 3.0;

  // 2. Applicazione deviazione gaussiana (se prevista)
  if (!noDev && sigma > 0 && typeof applicaDeviazioneGaussiana === 'function') {
    dt1 = applicaDeviazioneGaussiana(dt1, sigma);
    dtGap = applicaDeviazioneGaussiana(dtGap, sigma);
    dt2 = applicaDeviazioneGaussiana(dt2, sigma);
  }

  // Converti in interi (ms) solo prima di inviarli alla gestione ritardo
  dt1 = Math.round(dt1);
  dtGap = Math.round(dtGap);
  dt2 = Math.round(dt2);

  // 3. Impostazione della geometria
  const inputL = document.getElementById("lenUnica");
  if (inputL) inputL.value = Lcm;

  // 4. Esecuzione sequenza passthrough
  const elemStato = document.getElementById("statoIniziale");
  const primoStato = (elemStato && elemStato.value === "1") ? "light" : "dark";
  const secondoStato = primoStato === "light" ? "dark" : "light";

  // Calcola e compila la colonna di sinistra (vista Live)
  gestioneRitardo(dt1, primoStato, Lcm);
  gestioneRitardo(dtGap, secondoStato, Lcm);
  gestioneRitardo(dt2, primoStato, Lcm);

  // 5. Log di conferma
  if (cassettiera && cassettiera.log) {
    const devText = noDev ? "NO DEV (Esatto)" : `Gaussiana (σ = ${sigma}%)`;
    cassettiera.log.textContent = 
      `🧪 Test Virtuale [${devText}]: dt1=${formatta4Cifre(dt1)}ms, dt_gap=${formatta4Cifre(dtGap)}ms, dt2=${formatta4Cifre(dt2)}ms, L=${Lcm}cm`;
  }
}

function avviaStreamLive(idSessione) {
  if (!idSessione) return;
  if ( typeof avviaStreamLive.ultimaFirmaSSE == 'undefined') {
    avviaStreamLive.ultimaFirmaSSE = null;
  }

  if (sorgenteSSE) {
    sorgenteSSE.close();
  }

  window.addEventListener('beforeunload', () => {
    fermaStreamLive();
  });

  /*
  $lista_eventi = [
    0 => "nuova_misura",
    1 => "salva_run",
    2 => "rimuovi_dati",
    3 => "modifica_nota",
    4 => "modifica_stato"
  ];
  */

  sorgenteSSE = new EventSource(`php/streamLive.php?sessione=${encodeURIComponent(idSessione)}&firmaSSE=${firmaClientSSE}`);

  sorgenteSSE.addEventListener('rimuovi_dati_inviata', (e) => {
    const risposta = JSON.parse(e.data);
    console.log("Conferma invio dal server:", risposta.message);
    // Gestione visiva di cortesia (es. spunta verde, feedback audio o notifica temporanea)
  });

  sorgenteSSE.addEventListener('nuova_misura_inviata', (e) => {
    const risposta = JSON.parse(e.data);
    console.log("Conferma invio dal server:", risposta.message);
    // Gestione visiva di cortesia (es. spunta verde, feedback audio o notifica temporanea)
  });

  sorgenteSSE.addEventListener('nuova_misura', (event) => {
    const datoLive = JSON.parse(event.data);
    console.log("⚡ Ricevuta nuova misura live via SSE:", datoLive);

    // Helper locale per aggiornare valore visibile e tooltip (title) in un solo colpo
    const aggiornaCella = (elemento, valore, unitaMisura = "") => {
      if (!elemento) return;

      if (valore !== undefined && valore !== null && valore !== "--" && !isNaN(valore)) {
        const suffisso = unitaMisura ? ` ${unitaMisura}` : "";
        elemento.textContent = `${formattaMisura(valore)}${suffisso}`;
        elemento.title = formattaTitleScientifico(valore, unitaMisura);
      } else {
        elemento.textContent = "--";
        elemento.removeAttribute("title");
      }
    };

    // --- TEMPI (es. ms o s, aggiusta l'unità di misura se necessario) ---
    aggiornaCella(cassettiera.valoreC1, datoLive.dt1, "ms");
    aggiornaCella(cassettiera.valoreC2, datoLive.dt2, "ms");
    aggiornaCella(cassettiera.valoreGap, datoLive.dt_gap, "ms");
    aggiornaCella(cassettiera.valoreTotale, datoLive.dt_tot, "ms");

    // --- VELOCITÀ (cm/s) ---
    aggiornaCella(cassettiera.velC1, datoLive.v1, "cm/s");
    aggiornaCella(cassettiera.velC2, datoLive.v2, "cm/s");
    aggiornaCella(cassettiera.velGap, datoLive.v_gap, "cm/s");
    aggiornaCella(cassettiera.velMedia, datoLive.v_media, "cm/s");

    // --- ACCELERAZIONI (cm/s²) ---
    aggiornaCella(cassettiera.acc12, datoLive.a12, "cm/s²");
    aggiornaCella(cassettiera.acc23, datoLive.a23, "cm/s²");
    aggiornaCella(cassettiera.acc13, datoLive.a13, "cm/s²");
    aggiornaCella(cassettiera.accMinQ, datoLive.a_min_quad, "cm/s²");
  });

  sorgenteSSE.addEventListener('errore_sessione', (event) => {
    const err = JSON.parse(event.data);
    console.error("🛑 Errore SSE:", err.message);
    fermaStreamLive();
  });

  sorgenteSSE.addEventListener('ping', (event) => {
    if (!avviaStreamLive.ultimaFirmaSSE || avviaStreamLive.ultimaFirmaSSE !== nuovaFirma) {
      console.log("⚡ SSE Connesso al server live:", JSON.parse(event.data));
    }
  });

  sorgenteSSE.addEventListener('rimuovi_dati', (event) => {
    const listaDaRimuovere = (JSON.parse(event.data)['ids_rimossi']);
    console.log("listaDaRimuovere:",listaDaRimuovere);
    dataset = scambioDati.datasetSessione
    listaDaRimuovere.forEach(id => {
      scambioDati.rimuoviMisuraLocale(id);
      rigaDomDaRimuovere = document.getElementById(String(id))
      if (rigaDomDaRimuovere) rigaDomDaRimuovere.remove();
    });
  });

  sorgenteSSE.addEventListener('modifica_stato', (event) => {
    const modifica_stato = JSON.parse(event.data);
    if (!Array.isArray(modifica_stato)) return;

    // Il ciclo elabora ogni riga inviata dal server
    modifica_stato.forEach(riga => {
      if (!riga.id) return;

      // Dichiarazione interna al ciclo
      const idTarget = parseInt(riga.id, 10);
      const isChecked = parseInt(riga.esclusa, 10) === 1;

      // 1. Aggiorna lo store centrale tramite il suo metodo pubblico
      scambioDati.aggiornaStatoMisura(idTarget, isChecked ? 1 : 0);

      // 2. Aggiorna la Checkbox nel DOM
      const input_checkBox = document.getElementById("input_checkBox-" + idTarget);

      // 3. AGGIORNAMENTO CSS (Spostato DENTRO il ciclo, dove idTarget e input_checkBox esistono!)
      const rigaDom = document.getElementById(String(idTarget)) || input_checkBox?.closest('tr');

      if (rigaDom) {
        // Toggle della classe visiva standard
        rigaDom.classList.toggle("esclusa", isChecked);

        // Feedback visivo immediato tramite stile inline (azzera l'attesa di repaint)
        rigaDom.style.opacity = isChecked ? "0.4" : "1";
        rigaDom.style.textDecoration = isChecked ? "line-through" : "none";
      }

    }); // <-- Fine del ciclo forEach

    // 4. Ricalcola le statistiche (fuori dal ciclo, va eseguito una sola volta alla fine)
    if (typeof aggiornaSintesiStatistica === 'function') {
      aggiornaSintesiStatistica(scambioDati.datasetSessione);
    }
  });

  sorgenteSSE.addEventListener('modifica_nota', (event) => {
    const notaAcquisita = JSON.parse(event.data)[0];
    console.log("notaAcquisita", notaAcquisita);

    if (!notaAcquisita || !notaAcquisita.id) return;

    const idTarget = parseInt(notaAcquisita.id, 10);
    const nuovoTestoNota = notaAcquisita.note || '';

    // 1. Aggiorna lo store centrale tramite il suo metodo pubblico
    //scambioDati.aggiornaTestoNota(idTarget, nuovoTestoNota);


    if (Array.isArray(scambioDati.datasetSessione)) {
      const rigaInMemoria = scambioDati.datasetSessione.find(m => parseInt(m.id, 10) === idTarget);
      if (rigaInMemoria) {
        rigaInMemoria.note = nuovoTestoNota;
      }
    }

    const btnNota = document.getElementById("nota-" + idTarget);
    if (btnNota) {
      if (nuovoTestoNota.trim() !== '') {
        btnNota.classList.add('has-note');
        btnNota.setAttribute("title", nuovoTestoNota);
      } else {
        btnNota.classList.remove('has-note');
        btnNota.setAttribute("title", "Aggiungi / Modifica nota");
      }
    }
  });

  sorgenteSSE.addEventListener('salva_run', (event) => {
    const misuraDaSalvare = JSON.parse(event.data);
    const nuoveMisure = Array.isArray(misuraDaSalvare) ? misuraDaSalvare : [misuraDaSalvare];

    nuoveMisure.forEach(nuovaRun => {
      if (document.getElementById(nuovaRun.id)) return;

      // Mantiene allineato ScambioDati se presente
      if (scambioDati) {
        scambioDati.upsertMisuraLocale(nuovaRun);
      }

      renderizzaRigaMisura(nuovaRun);
    });

    if (typeof aggiornaSintesiStatistica === 'function') {
      aggiornaSintesiStatistica(scambiaDati.datasetSessione);
    }
  });

  sorgenteSSE.onerror = (err) => {
    console.warn("⚠️ Connessione SSE interrotta, tentativo di riconnessione automatica...", err);
  };
}

function fermaStreamLive() {
  if (sorgenteSSE) {
    sorgenteSSE.close();
    sorgenteSSE = null;
    console.log("🛑 Stream SSE chiuso.");
  }
}

function inviaDatoLiveData(misuraCompleta) {
  // Recupera l'ID sessione sia dallo store 'scambioDati' che dal fallback 'window.sessioneAttivaCorrente'
  const idSessione = (scambioDati && scambioDati.sessioneAttiva);

  if (!idSessione) {
    console.warn("[inviaDatoLiveData] Invio annullato: nessuna sessione attiva impostata.");
    return;
  }

  const payload = {
    ...misuraCompleta,
    session_id: idSessione,
    firmaSSE: firmaClientSSE
  };

  console.log("📤 [inviaDatoLiveData] Invio record in corso a salvaLiveData.php:", payload);

  fetch('php/salvaLiveData.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      console.log("✅ [inviaDatoLiveData] Risposta server salvaLiveData.php:", data);
    })
    .catch(err => console.error("❌ Errore invio liveData:", err));
}

// ==========================================
// 11. FUNZIONI D'APPOGGIO PER EVENTUALI UTILIZZI DI TEST
// ==========================================

async function caricaDatiSessione(idSessione, idsSelezionati = []) {
  if (!idSessione || !scambioDati) return;
  try {
    const stato = await scambioDati.caricaDatiSessione(idSessione);
    if (stato) {
      popolaTabellaAnalisi(stato.misure, idsSelezionati);
    }
  } catch (err) {
    mostraErrore("Impossibile ricaricare la sessione.");
  }
}
