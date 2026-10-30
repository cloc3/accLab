// Dichiarazione globale per i due singleton di interfaccia e dati
let cassettiera;
let scambioDati;

// ==========================================
// CLASS: SCAMBIO DATI (Data Store Privato)
// ==========================================

class ScambioDati {
  // Proprietà private dello stato di sessione
  #datasetSessione = [];
  #sessioneAttiva;
  #isSessioneConfermata;
  #parametri = {};
  #colori = {};
  #metadati = {};
  #idSessioneCorrente = null;

  constructor() {
    this.#resetStato();
    this.#sessioneAttiva = null;
  }

  #resetStato() {
    this.#datasetSessione = [];
    this.#parametri = {};
    this.#colori = {};
    this.#metadati = {};
    this.#idSessioneCorrente = null;
  }

  // --- GETTER PROTETTI (Restituiscono copie per evitare mutazioni indesiderate) ---

  get sessioneAttiva() {
    return this.#sessioneAttiva;
  }

  set sessioneAttiva(sessionId) {
    if (this.#sessioneAttiva !== sessionId) {
      this.#sessioneAttiva = sessionId;
      // Se l'ID sessione cambia, azzeriamo la conferma d'esistenza
      this.#isSessioneConfermata = false;
    }
  }

  get isSessioneConfermata() {
    return this.#isSessioneConfermata;
  }

  confermaSessione() {
    this.#isSessioneConfermata = true;
  }

  get datasetSessione() {
    return [...this.#datasetSessione];
  }

  /*
  al momento non è utilizzato.
  set datasetSessione(nuoviDati) {
    this.#datasetSessione = Array.isArray(nuoviDati) ? nuoviDati : [];
  }
  */

  get parametri() {
    return { ...this.#parametri };
  }

  get colori() {
    return { ...this.#colori };
  }

  get metadati() {
    return { ...this.#metadati };
  }

  get idSessioneCorrente() {
    return this.#idSessioneCorrente;
  }

  // --- UNICA CHIAMATA DI RETE ---

  /**
   * Esegue l'unica Fetch iniziale per caricare tutto lo stato della sessione dal server.
   */
  async caricaDatiSessione(idSessione) {
    if (!idSessione) {
      this.#resetStato();
      return null;
    }

    try {
      const response = await fetch(`php/caricaSessione.php?sessione=${encodeURIComponent(idSessione)}`);
      const res = await response.json();

      if (res.status !== 'ok') {
        throw new Error(res.message || "Errore nel caricamento della sessione.");
      }

      // Stoccaggio immediato di tutte le sezioni del payload
      this.#idSessioneCorrente = idSessione;
      this.#datasetSessione    = res.misure || [];
      this.#parametri          = res.parametri || {};
      this.#colori             = res.colori || {};
      this.#metadati           = res.metadati || {};

      // Restituisce un riepilogo dello stato appena caricato
      return {
        misure: this.datasetSessione,
        parametri: this.parametri,
        colori: this.colori,
        metadati: this.metadati
      };

    } catch (err) {
      console.error("[ScambioDati] Errore durante il caricamento della sessione:", err);
      this.#resetStato();
      throw err;
    }
  }

  // --- METODI DI AGGIORNAMENTO LOCALE (Senza fare nuove Fetch) ---

  aggiornaStatoMisura(id, nuovaEsclusa) {
    const misura = this.#datasetSessione.find(m => parseInt(m.id, 10) === parseInt(id, 10));
    if (misura) {
      misura.esclusa = parseInt(nuovaEsclusa, 10);
    }
  }

  aggiornaTestoNota(id, nuovaNota) {
    const misura = this.#datasetSessione.find(m => parseInt(m.id, 10) === parseInt(id, 10));
    if (misura) {
      misura.note = nuovaNota;
    }
  }

  rimuoviMisuraLocale(idMisura) {
    this.#datasetSessione = this.#datasetSessione.filter(
      m => parseInt(m.id, 10) !== parseInt(idMisura, 10)
    );
  }

  upsertMisuraLocale(nuovaMisura) {
    const idx = this.#datasetSessione.findIndex(m => parseInt(m.id, 10) === parseInt(nuovaMisura.id, 10));
    if (idx >= 0) {
      this.#datasetSessione[idx] = nuovaMisura;
    } else {
      this.#datasetSessione.push(nuovaMisura);
    }
  }

  aggiornaParametriLocali(nuoviParametri) {
    this.#parametri = { ...this.#parametri, ...nuoviParametri };
  }

  aggiornaColoriLocali(nuoviColori) {
    this.#colori = { ...this.#colori, ...nuoviColori };
  }
}

// ==========================================
// CLASS: CASSETTIERA (UI & Controller)
// ==========================================

class Cassettiera {
  constructor() {

    // Riferimenti Terzo Riquadro: Scambio Dati (Exchange)
    this.boxScambioDati = document.getElementById("boxScambioDati");
    this.btnExportJSON = document.getElementById("btnExportJSON");
    this.btnExportCSV = document.getElementById("btnExportCSV");
    this.inputImportFile = document.getElementById("inputImportFile");

    // Riferimenti Pulsanti Salvataggio Configurazione
    this.btnSalvaParametri = document.getElementById("btnSalvaParametri");
    this.btnSalvaColori = document.getElementById("btnSalvaColori");

    // Riferimenti DOM per le Linguette / Viste
    this.tabLive = document.getElementById("tabLive");
    this.tabAnalisi = document.getElementById("tabAnalisi");
    this.vistaLive = document.getElementById("vistaLive");
    this.vistaAnalisi = document.getElementById("vistaAnalisi");
    this.corpoTabellaSessione = document.getElementById("corpoTabellaSessione");

    // Inizializzazione Riferimenti DOM
    this.btnSalvaRun = document.getElementById("btnSalvaRun");
    this.boxSessione = document.getElementById("boxSessione");
    this.connessione = document.getElementById("tastoConnessione");
    this.disconnessione = document.getElementById("tastoDisconnessione");
    this.avvio = document.getElementById("avvioAcq");
    this.reset = document.getElementById("resetMisura");
    this.log = document.getElementById("log");
    this.btnEsciSessione = document.getElementById("btnEsciSessione");
    this.boxEsciSessione = document.getElementById("boxEsciSessione");

    // Input Unico Geometria
    this.lenUnica = document.getElementById("lenUnica");

    // Display Output
    this.valoreC1 = document.getElementById("valoreC1");
    this.valoreGap = document.getElementById("valoreGap");
    this.valoreC2 = document.getElementById("valoreC2");
    this.valoreTotale = document.getElementById("valoreTotale");

    this.velC1 = document.getElementById("velC1");
    this.velGap = document.getElementById("velGap");
    this.velC2 = document.getElementById("velC2");
    this.velMedia = document.getElementById("velMedia");

    // Accelerazioni
    this.acc12 = document.getElementById("acc12");
    this.acc23 = document.getElementById("acc23");
    this.acc13 = document.getElementById("acc13");
    this.accMinQ = document.getElementById("accMinQ");

    this.boxErrore = document.getElementById("boxErrore");
    this.messaggioErrore = document.getElementById("messaggioErrore");

    // Binding degli eventi Salvataggio Parametri
    if (this.btnSalvaParametri) {
      this.btnSalvaParametri.addEventListener("click", () => {
        if (typeof salvaConfigurazioneCorrente === "function") {
          salvaConfigurazioneCorrente("parametri");
        }
      });
    }

    if (this.btnSalvaColori) {
      this.btnSalvaColori.addEventListener("click", () => {
        if (typeof salvaConfigurazioneCorrente === "function") {
          salvaConfigurazioneCorrente("colori");
        }
      });
    }

    // Binding eventi Scambio Dati
    if (this.btnExportJSON) {
      this.btnExportJSON.addEventListener("click", () => {
        if (typeof esportaDatiJSON === 'function') esportaDatiJSON();
      });
    }
    if (this.btnExportCSV) {
      this.btnExportCSV.addEventListener("click", () => {
        if (typeof esportaDatiCSV === 'function') esportaDatiCSV();
      });
    }
    if (this.inputImportFile) {
      this.inputImportFile.addEventListener("change", (e) => {
        if (typeof importaFileDati === 'function') importaFileDati(e);
      });
    }

    // Binding degli eventi per il cambio Vista
    if (this.tabLive && this.tabAnalisi) {
      this.tabLive.addEventListener("click", () => this.mostraVistaLive());
      this.tabAnalisi.addEventListener("click", () => this.mostraVistaAnalisi());
    }

    // Binding degli Eventi
    if (this.disconnessione) {
      this.disconnessione.addEventListener('click', () => eventoDisconnetti());
    }
    if (this.connessione) {
      this.connessione.addEventListener('click', () => eventoConnetti());
    }
    if (this.avvio) {
      this.avvio.addEventListener('click', function() { eventoMonitor(this); });
    }
    if (this.reset) {
      this.reset.addEventListener('click', () => { if (typeof resetMisura === 'function') resetMisura(); });
    }
    if (this.btnSalvaRun) {
      this.btnSalvaRun.addEventListener('click', gestisciSalvaRun);
    }

    if (this.btnEsciSessione) {
      this.btnEsciSessione.addEventListener('click', () => {
        if (typeof esciSessione === 'function') {
          esciSessione();
        }
      });
    }

    // Personalizzazione Colori
    this.initColori();

    // Inizializzazione Interfaccia Sessione (Fixed casing: initSessioneUI)
    this.initSessioneUI();
  }

  mostraBtnSalva() {
    if (this.btnSalvaRun) this.btnSalvaRun.classList.remove("hidden");
    if (this.boxSessione) this.boxSessione.classList.remove("hidden");
  }

  nascondiBtnSalva() {
    if (this.btnSalvaRun) this.btnSalvaRun.classList.add("hidden");
    if (this.boxSessione) this.boxSessione.classList.add("hidden");
  }

  mostraBtnEsci() {
    if (this.boxEsciSessione) this.boxEsciSessione.classList.remove("hidden");
  }

  nascondiBtnEsci() {
    if (this.boxEsciSessione) this.boxEsciSessione.classList.add("hidden");
  }

  abilitaBtnRun() {
    if (this.avvio) {
      this.avvio.disabled = false;
    }
  }

  disabilitaBtnRun() {
    if (this.avvio) {
      this.avvio.disabled = true;
    }
  }

  impostaModalitasingola() {
    // Nasconde la linguetta di analisi fuori dalla sessione
    if (this.tabAnalisi) this.tabAnalisi.classList.add("hidden");

    // Nasconde il box Scambio Dati in modalità misura semplice
    if (this.boxScambioDati) this.boxScambioDati.classList.add("hidden");

    // Forza la vista Live
    this.mostraVistaLive();

    // Log pulito
    if (this.log) this.log.textContent = "modalità singola misura";
  }

  impostaModalitaSessione() {
    // Mostra la linguetta di analisi e il box scambio dati
    if (this.tabAnalisi) this.tabAnalisi.classList.remove("hidden");
    if (this.boxScambioDati) this.boxScambioDati.classList.remove("hidden");

    // Verifica se c'è un test in corso via URL o se i dati della misura attuale sono già compilati
    const urlParams = new URLSearchParams(window.location.search);
    const haMisuraCompletata = this.valoreTotale && this.valoreTotale.textContent.trim() !== "";

    if (urlParams.has('test') || haMisuraCompletata) {
      // Mantiene/forza il focus sulla vista Live (Misura in Corso)
      this.mostraVistaLive();
    } else {
      // Altrimenti passa alla vista Analisi Sessione
      this.mostraVistaAnalisi();
    }
  }

  initColori() {
    const cSfondo = document.getElementById("colorSfondo");
    const cHeader = document.getElementById("colorHeader");
    const cCard = document.getElementById("colorCard");
    const btnResetColori = document.getElementById("btnRipristinaColori");

    if (cSfondo && cHeader && cCard) {
      cSfondo.addEventListener("input", (e) => document.documentElement.style.setProperty('--bg-pagina', e.target.value));
      cHeader.addEventListener("input", (e) => document.documentElement.style.setProperty('--bg-header', e.target.value));
      cCard.addEventListener("input", (e) => document.documentElement.style.setProperty('--bg-card', e.target.value));

      if (btnResetColori) {
        btnResetColori.addEventListener("click", () => {
          document.documentElement.style.setProperty('--bg-pagina', '#ffffe0');
          document.documentElement.style.setProperty('--bg-header', '#ffe4b5');
          document.documentElement.style.setProperty('--bg-card', '#111827');
          cSfondo.value = "#ffffe0";
          cHeader.value = "#ffe4b5";
          cCard.value = "#111827";
        });
      }
    }
  }

  initSessioneUI() {
    const inputNome = document.getElementById("nomeSessione");
    const labelNome = document.querySelector("label[for='nomeSessione']");

    if (!inputNome) return;

    // Gestione dinamica dell'etichetta al focus
    inputNome.addEventListener("focus", () => {
      if (inputNome.disabled) return;
      if (labelNome) labelNome.textContent = "Nome nuova sessione:";
    });

    // Aggiornamento dello stato globale all'uscita dal campo di testo
    inputNome.addEventListener("blur", () => {
      if (inputNome.disabled) return;
      const valore = inputNome.value.trim();

    });
  }

  mostraVistaLive() {
    if (!this.tabLive || !this.tabAnalisi || !this.vistaLive || !this.vistaAnalisi) return;

    this.tabLive.classList.add("active");
    this.tabLive.style.background = "var(--bg-header, #ffe4b5)";
    this.tabLive.style.color = "#000000";

    this.tabAnalisi.classList.remove("active");
    this.tabAnalisi.style.background = "rgba(255,255,255,0.2)";
    this.tabAnalisi.style.color = "inherit";

    this.vistaLive.classList.remove("hidden");
    this.vistaAnalisi.classList.add("hidden");
  }

  async mostraVistaAnalisi() {
    if (!this.tabLive || !this.tabAnalisi || !this.vistaLive || !this.vistaAnalisi) return;

    this.tabAnalisi.classList.add("active");
    this.tabAnalisi.style.background = "var(--bg-header, #ffe4b5)";
    this.tabAnalisi.style.color = "#000000";

    this.tabLive.classList.remove("active");
    this.tabLive.style.background = "rgba(255,255,255,0.2)";
    this.tabLive.style.color = "inherit";

    this.vistaAnalisi.classList.remove("hidden");
    this.vistaLive.classList.add("hidden");

    // I dati sono già stati pre-caricati all'avvio da controllaSessioneDaUrl
    const datiSessione = scambioDati.datasetSessione;

    if (datiSessione && datiSessione.length > 0) {
      popolaTabellaAnalisi(datiSessione);
    } else {
      mostraTabellaVuotaODisattivata();
    }
  }
}

function controllaModalitaTestDaUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const isTest = urlParams.has('test');
  // Se il test non è richiesto, usciamo all'istante
  if (!isTest) return;

  // Se il test è richiesto, avviamo la simulazione
  eseguiTestVirtualeConAttesa();
}

function eseguiTestVirtualeConAttesa() {
  // Avvia i calcoli o le operazioni locali immediate della simulazione...
  simulaRunVirtuale(); 

  // Funzione che apre la vista finale in modo sicuro
  const apriVistaFinale = () => {
  };

  // SE l'evento 'sessionePronta' è già stato emesso (es. se la fetch era velocissima o misura singola)
  // o se dobbiamo ancora attenderlo:
  window.addEventListener('sessionePronta', () => {
    apriVistaFinale();
  }, { once: true }); // { once: true } rimuove il listener automaticamente dopo il primo scatto
}

// Inizializzazione al caricamento del DOM
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    scambioDati = new ScambioDati();
    cassettiera = new Cassettiera();

    if (typeof eventoDisconnetti === 'function') {
      eventoDisconnetti();
    }

    // 1. Prima verifichiamo la sessione (Sincrono/Asincrono)
    if (typeof controllaSessioneDaUrl === 'function') {
      controllaSessioneDaUrl().then((sessionId) => {
        console.log(" Sessione stabilita:", sessionId);

        // 2. SOLO ORA, con l'ID sessione pronto (o null), avviamo la modalità test se richiesta
        if (typeof controllaModalitaTestDaUrl === 'function') {
          controllaModalitaTestDaUrl(); 
        }
      });
    }
  });
})();
