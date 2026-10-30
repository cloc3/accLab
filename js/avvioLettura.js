let tinta = 0;
let bufferDati = "";
let ritardo;

let analizzatoreRisposta = (data) => {
	let textDecoder = new TextDecoder();
	bufferDati += textDecoder.decode(data, { stream: true });
	console.log("bufferDati = " + bufferDati);

	if (!bufferDati.includes('\n')) return;

	const ultimoTerminato = bufferDati.lastIndexOf('\n');
	const datiCompleti = bufferDati.substring(0, ultimoTerminato);
	bufferDati = bufferDati.substring(ultimoTerminato + 1);

	const righe = datiCompleti.split('\n');
	for (let riga of righe) {
		riga = riga.trim();
		if (riga === "") continue;

		try {
			const json = JSON.parse(riga);
			console.log("JSON RICEVUTO CORRETTAMENTE:", json);

			// 1. Handshake riuscito tramite "ready"
			if (json.status === "ready") {
				if (typeof timerSveglia !== 'undefined' && timerSveglia !== null) {
					clearInterval(timerSveglia);
					timerSveglia = null;
					console.log("Handshake completato: timerSveglia disattivato.");
				}
				cassettiera.log.textContent = "pagina web in ascolto";
				window.setTimeout(() => { cassettiera.log.textContent = ""; }, 1500);
				continue;
			}

			// 2. Misura in arrivo
			if (json.rit !== undefined) {
				// Sgancio di sicurezza nel caso il pacchetto ready fosse andato perso
				if (typeof timerSveglia !== 'undefined' && timerSveglia !== null) {
					clearInterval(timerSveglia);
					timerSveglia = null;
				}
				gestioneRitardo(json.rit, json.stato);
			}

		} catch (error) {
			console.error("Errore nel parsing del JSON o pacchetto incompleto:", error);
		}
	}
};
