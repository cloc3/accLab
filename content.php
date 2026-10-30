<!DOCTYPE html>
<html lang="it">
  <head>
    <meta http-equiv="content-type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="css/layout.css">
    <link rel="stylesheet" type="text/css" href="css/pulsanti.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Trirong">
    <script src="./js/serial.js"></script>
    <script src="./js/connessioni.js"></script>
    <script src="./js/main.js"></script>
    <script src="./js/eventoMonitor.js"></script>
    <script src="./js/runManager.js"></script>
    <script src="./js/mathFunctions.js"></script>
    <script src="./js/avvioLettura.js"></script>
    <title>accLab</title>
  </head>

  <body>
    <header id="header">
      <div class="brand">
        <h1 id="titolo" style="display:inline-flex; align-items:center;gap:50px;font-family: Trirong">
          <img id="apriLeTueFinestre" src="img/apriLeTueFinestre.png" alt="open your windows">
          <!--span style="font-size:1.6em">accLab</span-->
          cinematica con una fotocellula</h1>
      </div>
    </header>

    <div id="container">

      <!-- COLONNA SINISTRA: PULSANTI DI COMANDO (VERTICALI) -->
      <aside id="colonnaComandi">
        <h2>Comandi</h2>
        <div class="gruppoPulsantiVerticali">
          <button id="tastoConnessione" type="button" class="btnGrande">Connetti</button>
          <button id="tastoDisconnessione" type="button" class="btnGrande">Disconnetti</button>
          <button id="avvioAcq" type="button" class="btnGrande pulsanteAvvio">Run</button>
          <button id="resetMisura" type="button" class="btnGrande btnReset">Reset</button>

          <div id="boxSessione" class="box-sessione">
            <!-- Stato 1: Inserimento nuova sessione -->
            <div id="boxInputSessione">
              <div class="field-group">
                <label for="nomeSessione">Nome sessione:</label>
                <input type="text" id="nomeSessione" autocomplete="off">
              </div>
            </div> <!-- 👈 CHIUSO CORRETTAMENTE QUI -->

            <!-- Stato 2: Visualizzazione sessione attiva -->
            <div id="boxSessioneAttiva" class="hidden">
              <label>Sessione attiva:</label>
              <strong id="nomeSessioneFisso" style="display:block; margin-top:4px; font-size:1.05em; color:var(--bg-header, #ffe4b5);"></strong>

              <!-- Contenitore per il QR Code -->
              <div id="qrCodeContainer" style="margin-top: 10px; display: flex; justify-content: center; background: #ffffff !important; padding: 6px; border-radius: 4px;"></div>

              <!-- Link testo sessione -->
              <div style="margin-top: 8px; background-color: #ffffff !important; padding: 6px; border-radius: 4px; text-align: center;">
                <a id="urlSessioneTesto" href="javascript:void(0)" target="_blank" style="display: block !important; font-size: 0.8em !important; color: #000000 !important; background-color: #ffffff !important; text-decoration: none !important; word-break: break-all !important; user-select: all !important;"></a>
              </div>
            </div>
          </div>

          <button id="btnSalvaRun" class="btn btn-salva hidden">💾 Salva Run</button>
        </div>

        <p id="log" class="statoLog"></p>

        <!-- BOX ERRORE -->
        <div id="boxErrore" class="hidden">
          <span id="messaggioErrore"></span>
        </div>

        <!-- IN FONDO ALLA COLONNA COMANDI -->
        <div id="boxEsciSessione" class="hidden style-group mt-4">
          <button id="btnEsciSessione" type="button">
            Esci da Sessione
          </button>
        </div>
      </aside>

      <!-- COLONNA CENTRALE: INPUT GEOMETRIA + COLORI + SCAMBIO DATI -->
      <section id="colonnaConfigurazione">

        <!-- 1. BOX PARAMETRI ESPERIMENTO -->
        <div class="cardConfig">
          <h2>Parametri</h2>
          <div class="campoInputUnico">
            <label for="lenUnica">Spazio &Delta;s (cm):</label>
            <input type="number" id="lenUnica" value="10" min="0.1" step="0.1">
          </div>

          <div class="campoInputUnico" style="margin-top: 10px;">
            <label for="timeOutSec">Timeout (s):</label>
            <input type="number" id="timeOutSec" value="4" min="1" max="30" step="1">
          </div>

          <div class="campoInputUnico" style="margin-top: 10px;">
            <label for="statoIniziale">Stato Avvio:</label>
            <select id="statoIniziale">
              <option value="0" selected>0 - Oscurato - (Sensore LOW)</option>
              <option value="1">1 - Libero (Sensore HIGH)</option>
            </select>
          </div>

          <!-- PULSANTE SALVA PARAMETRI -->
          <div style="margin-top: 12px; text-align: right;">
            <button id="btnSalvaParametri" type="button" class="btnSmall">💾 Salva Parametri</button>
          </div>
        </div> 

        <!-- 2. BOX TEMA & COLORI -->
        <div class="cardConfig">
          <h2>Tema & Colori</h2>
          <div class="gruppoColori">
            <div class="campoColore">
              <label for="colorSfondo">Sfondo Pagina:</label>
              <input type="color" id="colorSfondo" value="#ffffe0">
            </div>
            <div class="campoColore">
              <label for="colorHeader">Intestazione:</label>
              <input type="color" id="colorHeader" value="#ffe4b5">
            </div>
            <div class="campoColore">
              <label for="colorCard">Sfondo Display:</label>
              <input type="color" id="colorCard" value="#111827">
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <button id="btnRipristinaColori" type="button" class="btnSmall" style="flex: 1;">Ripristina Def.</button>
              <!-- PULSANTE SALVA COLORI -->
              <button id="btnSalvaColori" type="button" class="btnSmall" style="flex: 1;">💾 Salva Colori</button>
            </div>
          </div>
        </div>

        <!-- 3. BOX SCAMBIO DATI (CHANGE / EXCHANGE) -->
        <div id="boxScambioDati" class="cardConfig hidden">
          <h2>Scambio Dati (Export / Import)</h2>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
            <!-- Esportazione -->
            <div style="display: flex; gap: 6px;">
              <button id="btnExportJSON" type="button" class="btnSmall" style="flex: 1;" title="Esporta dati in formato JSON">
                📤 Esporta JSON
              </button>
              <button id="btnExportCSV" type="button" class="btnSmall" style="flex: 1;" title="Esporta dati in formato CSV per Excel">
                📊 Esporta CSV
              </button>
            </div>

            <hr style="border: 0; border-top: 1px solid rgba(0,0,0,0.1); margin: 2px 0;">

            <!-- Importazione -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label for="inputImportFile" style="font-size: 0.9em; font-weight: bold;">Importa Sessione:</label>
              <!-- Opzioni Import -->
              <div style="font-size: 0.85em; display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.05); padding: 6px 8px; border-radius: 4px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" id="chkImportAccoda">
                  Accoda i nuovi dati (mantiene quelli attuali)
                </label>

                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" id="chkImportParametri">
                  Sovrascrivi i parametri di lavoro (&Delta;s, timeout...)
                </label>

                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" id="chkImportColori">
                  Sovrascrivi i colori del tema
                </label>
              </div>

              <input type="file" id="inputImportFile" accept=".json,.csv" style="font-size: 0.85em;">
            </div>
          </div>
        </div>

      </section>
      <!-- COLONNA DESTRA: MAIN -->
      <main id="colonnaRisultati">

        <!-- BARRA SUPERIORE DEDICATA AL FULLSCREEN -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <!-- BARRA LINGUETTE -->
          <div id="baroLinguette" class="linguette-container" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
            <button id="tabLive" type="button" class="tab-btn active">📊 Misura In Corso</button>
            <button id="tabAnalisi" type="button" class="tab-btn hidden">📈 Analisi Sessione</button>
          </div>

          <!-- PULSANTE ESPANDI / RIPRISTINA -->
          <button id="btnToggleFullscreenRisultati" type="button" class="tab-btn" style="border-radius: 6px; padding: 6px 12px; font-size: 0.85em; background: rgba(255, 255, 255, 0.15);" onclick="toggleFullscreenRisultati()" title="Espandi a tutto schermo">
            ⛶ Ingrandisci
          </button>
        </div>

        <!-- VISTA LIVE -->
        <div id="vistaLive" class="vista-pannello">
          <h2>Dashboard Cinematica</h2>
          <div class="grigliaRisultati">
            <div class="rigaIntestazione">
              <div>Intervallo</div>
              <div>Tempo (&Delta;t)</div>
              <div>Velocità (v)</div>
              <div>Accelerazione (a)</div>
            </div>
            <div class="rigaDato">
              <div class="etichettaIntervallo">Cartellino 1</div>
              <div class="valoreDato"><span id="valoreC1">--</span> <small>ms</small></div>
              <div class="valoreDato"><span id="velC1">--</span> <small>m/s</small></div>
              <div class="valoreDato subAcc">a<sub>12</sub>: <span id="acc12">--</span> <small>cm/s²</small></div>
            </div>
            <div class="rigaDato highlight">
              <div class="etichettaIntervallo">Spazio Vuoto</div>
              <div class="valoreDato"><span id="valoreGap">--</span> <small>ms</small></div>
              <div class="valoreDato"><span id="velGap">--</span> <small>m/s</small></div>
              <div class="valoreDato subAcc">a<sub>23</sub>: <span id="acc23">--</span> <small>cm/s²</small></div>
            </div>
            <div class="rigaDato">
              <div class="etichettaIntervallo">Cartellino 2</div>
              <div class="valoreDato"><span id="valoreC2">--</span> <small>ms</small></div>
              <div class="valoreDato"><span id="velC2">--</span> <small>m/s</small></div>
              <div class="valoreDato subAcc">a<sub>13</sub>: <span id="acc13">--</span> <small>cm/s²</small></div>
            </div>
            <div class="rigaDato totale">
              <div class="etichettaIntervallo">Totale / Media</div>
              <div class="valoreDato"><span id="valoreTotale">--</span> <small>ms</small></div>
              <div class="valoreDato"><span id="velMedia">--</span> <small>m/s</small></div>
              <div class="valoreDato aRisultante">a<sub>min_quad</sub>: <span id="accMinQ">--</span> <small>cm/s²</small></div>
            </div>
          </div>
        </div>

        <!-- VISTA ANALISI SESSIONE -->
        <div id="vistaAnalisi" class="vista-pannello hidden">
          <h2>Analisi del Dataset</h2>

          <!-- SCHEDA STATISTICA SINTETICA -->
          <div class="cardConfig" style="margin-bottom: 16px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px;">
            <h3>Sintesi Statistica (N = <span id="statCount">0</span>)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 8px;">
              <div>
                <small>Velocità Media Globale (v̄):</small><br>
                <strong id="statVMedia" style="font-size: 1.2em; color: #ffeb3b;">--</strong> m/s
              </div>
              <div>
                <small>Accelerazione Media (ā):</small><br>
                <strong id="statAMedia" style="font-size: 1.2em; color: #ffeb3b;">--</strong> m/s²
              </div>
              <div>
                <small>Scarto Quad. Medio (&sigma;<sub>a</sub>):</small><br>
                <strong id="statSigmaA" style="font-size: 1.2em; color: #00bcd4;">--</strong> <small style="font-size: 0.85em; color: #b0bec5;">m/s²</small>
                <small id="statSigmaARel" style="font-size: 0.9em; color: #b0bec5; margin-left: 4px;">(--%)</small>
              </div>
            </div>
          </div>

          <!-- TABELLA RUN SALVATE -->
          <div style="overflow-x: auto;">
            <!-- BARRA AZIONI DI GRUPPO UNIFICATA -->
            <div id="barraAzioniGruppo" style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btnSmall" onclick="gestisciAzioniGruppo('toggle')" title="Inverte lo stato Includi/Escludi delle run selezionate">
                👁️/🙈 Includi / Escludi Selezionati
              </button>
              <button type="button" class="btnSmall" style="color: #ff5252;" onclick="gestisciAzioniGruppo('rimuovi_dati')" title="Elimina definitivamente le run selezionate">
                🗑️ Elimina Selezionati
              </button>
            </div>

            <table class="tabella-sessione">
              <!-- INTESTAZIONE IN ALTO -->
              <thead>
                <tr>
                  <th style="width: 30px;">
                    <input type="checkbox" id="chkSelezionaTutti" onclick="toggleSelezionaTutti(this)">
                  </th>
                  <th>Run #</th>
                  <th>&Delta;t1 (ms)</th>
                  <th>&Delta;tGap (ms)</th>
                  <th>&Delta;t2 (ms)</th>
                  <th>v media (m/s)</th>
                  <th>a media (m/s²)</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <!-- CORPO TABELLA (Dati dinamici JS) -->
              <tbody id="corpoTabellaSessione">
                <!--tr>
                  <td colspan="8" style="padding: 16px; opacity: 0.6; text-align: center;">
                    Nessun dato o nessuna sessione attiva.
                  </td>
                </tr-->
              </tbody>

              <!-- RIPETIZIONE INTESTAZIONE IN BASSO PER RETROCOMPATIBILITÀ E COMODITÀ -->
              <tfoot>
                <tr>
                  <th style="width: 30px;">
                    <input type="checkbox" id="chkSelezionaTuttiBottom" onclick="toggleSelezionaTutti(this)">
                  </th>
                  <th>Run #</th>
                  <th>&Delta;t1 (ms)</th>
                  <th>&Delta;tGap (ms)</th>
                  <th>&Delta;t2 (ms)</th>
                  <th>v media (m/s)</th>
                  <th>a media (m/s²)</th>
                  <th>Azioni</th>
                </tr>
              </tfoot>
            </table>

            <!-- SPANO FIRMA DEDICATO FUORI DALLA TABELLA MA DENTRO IL PANNELLO -->
            <div class="firma-container">
              accLab System &bull; <span style="font-style: normal;">cinematica con la fotocellula.</span>
            </div>
          </div>

        </div> <!-- Chiude #vistaAnalisi -->
      </main>

    </div>

    <footer id="footer">
      <p>
      <?php
            echo "<a href=\"https://validator.w3.org/nu/?doc=https://".$_SERVER['HTTP_HOST']."/".$dirFileSorgente."/".$fileSorgente.".php\" target=\"_blank\"><img src=\"https://www.w3.org/html/logo/img/html5-topper.png\" alt=\"validazione HTML\" style='width:70px;height:31px;'></a>";
                     ?>
                     <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/" target="_blank" style="width:88px;height:31px; padding-right:5px;padding-left:5px">
                       <img src="img/licenza.png" alt="licenza CC">
                     </a>
                     <?php
                                                  echo "<a href=\"https://jigsaw.w3.org/css-validator/validator?uri=https://".$_SERVER['HTTP_HOST']."/".$percorsoLocale."\" target=\"_blank\"><img src=\"https://jigsaw.w3.org/css-validator/images/vcss-blue\" alt=\"validazione CSS\" style='width:88px;height:31px;'></a>";
                                                           ?>
                                                           <br>
                                                           Attribuzione-Condividi allo stesso modo 4.0
      </p>
    </footer>

    <!-- MODAL 1: Gestione Note -->
    <div id="modalNote" class="modal-overlay" style="display: none;">
      <div class="modal-contenuto">
        <h3>📝 Note Misura <span id="modalNoteRunId"></span></h3>
        <textarea id="txtNotaMisura" rows="4" placeholder="Inserisci qui una nota o osservazione per questo record..."></textarea>
        <div class="modal-azioni">
          <button type="button" onclick="chiudiModal('modalNote')">Annulla</button>
          <button type="button" class="btn-primario" onclick="salvaNotaMisura()" >Salva Nota</button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: Dettagli e Parametri Avanzati -->
    <div id="modalDettagli" class="modal-overlay" style="display: none;">
      <div class="modal-contenuto modal-largo">
        <h3>🔍 Dettaglio & Parametri Avanzati (Run <span id="modalDettaglioRunId"></span>)</h3>
        <div id="corpoDettagliMisura" class="dettagli-grid">
          <!-- Popolato dinamicamente da JS -->
        </div>
        <div class="modal-azioni">
          <button type="button" onclick="chiudiModal('modalDettagli')">Chiudi</button>
        </div>
      </div>
    </div>
  </body>
</html>
