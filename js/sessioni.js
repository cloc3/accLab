/**
 * Inizializza l'ID sessione dalla URL o ne genera uno nuovo
 */
function getOrCreateSessionId() {
    const urlParams = new URLSearchParams(window.location.search);
    let sessione = urlParams.get('sessione');
    if (!sessione) {
        sessione = 'SESS_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        window.history.replaceState(null, '', `?sessione=${sessione}`);
    }
    return sessione;
}

const CURRENT_SESSION = getOrCreateSessionId();

/**
 * Aggiorna l'immagine del QR Code nella colonna comandi
 */
function aggiornaQRCode() {
    const urlCompleto = encodeURIComponent(`https://example.com/accLab/fotoCellula.php?sessione=${CURRENT_SESSION}`);
    const qrImg = document.getElementById("imgQrCode");
    if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${urlCompleto}`;
    }
}

/**
 * Salva lo stato e le preferenze attuali della sessione nel database
 */
function salvaConfigurazioni() {
    const elNick    = document.getElementById("inputNickname");
    const elBgPag   = document.getElementById("bgPagina");
    const elBgHead  = document.getElementById("bgHeader");
    const elBgCard  = document.getElementById("bgCard");
    const elLen     = document.getElementById("lenUnica");
    const elTimeout = document.getElementById("timeOutSec");
    const elStato   = document.getElementById("statoIniziale");

    const payload = {
        session_id: CURRENT_SESSION,
        nickname: elNick ? elNick.value : '',
        bg_pagina: elBgPag ? elBgPag.value : '#d0ddd9',
        bg_header: elBgHead ? elBgHead.value : '#aba3e6',
        bg_card: elBgCard ? elBgCard.value : '#111827',
        spazio_ds: elLen ? (parseFloat(elLen.value) || 10) : 10,
        timeout_sec: elTimeout ? (parseInt(elTimeout.value, 10) || 4) : 4,
        stato_iniziale: elStato ? (parseInt(elStato.value, 10) || 0) : 0
    };

    fetch('php/salvaConfig.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'error') {
            if (typeof mostraErrore === 'function') {
                mostraErrore(data.message);
            } else {
                console.warn(data.message);
            }
        } else {
            if (typeof nascondiErrore === 'function') {
                nascondiErrore();
            }
            console.log("Configurazione salvata correttamente.");
        }
    })
    .catch(err => console.error("Errore di rete durante il salvataggio:", err));
}
