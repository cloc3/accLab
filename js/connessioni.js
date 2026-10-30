let listaArduini = [];
let arduinoAttivo;

function eventoDisconnetti() {
    for (const elem of listaArduini) {
        elem.onReceiveError = error => {};
        elem.disconnect();
    }
    
    // Disabilita il tasto Run quando si disconnette
    if (cassettiera && typeof cassettiera.disabilitaBtnRun === 'function') {
        cassettiera.disabilitaBtnRun();
    }

    cassettiera.log.textContent = "dispositivi disconessi";
    console.log("dispositivi disconnessi");
    window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
}

function eventoConnetti() {
    serial.getPorts().then(ports => {
        serial.requestPort().then(selectedPort => {
            if (selectedPort == undefined) {
                cassettiera.log.textContent = "Nessun dispositivo selezionato";
                window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
                return;
            }
            if (!selectedPort.device_.opened) {
                selectedPort.connect().then(() => {
                    listaArduini.push(selectedPort);
                    arduinoAttivo = selectedPort;
                    arduinoAttivo.onReceive = data => streamHandler(data);
                    arduinoAttivo.onReceiveError = error => errorHandler(error);
                    
                    // Abilita il tasto Run solo dopo il successo della connessione
                    if (cassettiera && typeof cassettiera.abilitaBtnRun === 'function') {
                        cassettiera.abilitaBtnRun();
                    }

                    cassettiera.log.textContent = "Connessione stabilita";
                    console.log("Connessione stabilita");
                    window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
                });
            } else {
                cassettiera.log.textContent = "La porta selezionata è già aperta";
                console.log("La porta selezionata è già aperta");
                window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
            }
        });
    });
}
