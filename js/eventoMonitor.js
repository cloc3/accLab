let voidHandler = (data) => {};
let streamHandler = voidHandler;
let errorHandler = (error) => { console.log(error); };

let eventoMonitor = () => {
    // 1. Reset dei dati visivi precedenti
    if (typeof resetMisura === 'function') {
        resetMisura();
    }

    // 2. Riarmo dello streamHandler per l'ascolto attivo
    streamHandler = analizzatoreRisposta;

    // 3. Feedback visivo sul pulsante: Stato "Attesa evento" (Azzurro)
    if (cassettiera && cassettiera.avvio) {
        cassettiera.avvio.textContent = "Attesa evento";
        cassettiera.avvio.style.backgroundColor = "#00bcd4"; // Azzurro / Cyan
        cassettiera.avvio.style.color = "#ffffff";
    }

    if (listaArduini.length == 0) {
        cassettiera.log.textContent = "nessun dispositivo connesso";
        window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
        return;
    }

    for (let elem of listaArduini) {
        if (!elem.device_.opened) {
            cassettiera.log.textContent = "nessun dispositivo connesso";
            window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
            return;
        }

        arduinoAttivo = elem;
        let encoder = new TextEncoder();

        const elemStato = document.getElementById("statoIniziale");
        const comandoAvvio = elemStato ? elemStato.value : "0";

        if (typeof timerSveglia !== 'undefined' && timerSveglia !== null) {
            clearInterval(timerSveglia);
        }

        timerSveglia = setInterval(() => {
            arduinoAttivo.send(encoder.encode(comandoAvvio));
        }, 1000);

        cassettiera.log.textContent = "sincronizzazione in corso";
        console.log("sincronizzazione in corso (comando: " + comandoAvvio + ")");
        window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
    }
};
