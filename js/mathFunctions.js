/**
 * Genera un numero casuale con distribuzione normale (Gaussiana)
 * con media = 0 e deviazione standard = 1 (Algoritmo Box-Muller).
 */
function randomGaussiano() {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random(); // Evita log(0)
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Applica una deviazione percentuale gaussiana a un valore.
 * @param {number} valore - Il valore originale
 * @param {number} sigmaPerc - Percentuale di deviazione standard (es. 3 per 3%)
 * @returns {number} Valore perturbato
 */
function applicaDeviazioneGaussiana(valore, sigmaPerc) {
  if (!sigmaPerc || sigmaPerc <= 0) return valore;
  const deviazione = (sigmaPerc / 100.0) * valore;
  return valore + randomGaussiano() * deviazione;
}

/**
 * Formatta i tempi (in ms):
 * - Numeri interi per valori <= 99999 ms
 * - Notazione scientifica con 2 cifre significative per valori > 9999 ms
 */
function formattaTempo(ms) {
  const num = parseFloat(ms);
  if (isNaN(num) || !isFinite(num)) return "--";

  // Arrotonda all'intero per simulazione/visualizzazione standard
  const intero = Math.round(num);

  if (Math.abs(intero) <= 99999) {
    return String(intero);
  } else {
    return intero.toExponential(1); // 2 cifre significative totali (es. 1.2e+4)
  }
}

/**
 * Formatta misure decimali (velocità, accelerazioni, scarti):
 * - 1 <= x <= 999: 4 cifre significative
 * - 0 < x < 1: 3 cifre decimali con zero iniziale (es. 0.123)
 * - x <= 0 oppure x > 999: Notazione scientifica a 2 cifre significative (es. 1.2e+3)
 */
function formattaMisura(valore) {
  const num = parseFloat(valore);
  if (isNaN(num) || !isFinite(num)) return "--";

  const abs = Math.abs(num);

  if (abs >= 1 && abs <= 999) {
    return Number(num.toPrecision(4)).toString();
  } else if (abs > 0 && abs < 1) {
    // 3 cifre significative / decimali con '0.' iniziale (es. 0.048, 0.482)
    return num.toFixed(3);
  } else {
    // x <= 0 oppure x > 999
    if (num === 0) return "0.000";
    return num.toExponential(1); // 2 cifre significative (es. 1.2e+3, -5.4e+2)
  }
}

/**
 * Genera la notazione scientifica a 4 cifre significative per l'attributo title/tooltip.
 */
function formattaTitleScientifico(valore) {
  const num = parseFloat(valore);
  if (isNaN(num) || !isFinite(num)) return "";
  return num.toExponential(3); // 3 decimali nell'esponente = 4 cifre significative totali (es. 1.234e+2)
}

/**
 * Formatta un numero mantenendo esattamente 4 cifre significative.
 * Utilizza la notazione scientifica solo se strettamente necessario.
 */
function formatta4Cifre(valore) {
  const num = parseFloat(valore);
  if (isNaN(num)) return "--";
  if (num === 0) return "0.000";

  // toPrecision(4) garantisce 4 cifre significative
  const prec = num.toPrecision(4);

  // Rimuove l'esponente superfluo se toPrecision usa il formato e+0
  return Number(prec).toString().includes('e')
    ? prec
    : String(parseFloat(prec));
}

/**
 * Calcola l'accelerazione (cm/s^2) tramite regressione ai minimi quadrati
 * per s(t) = v0*t + 1/2*a*t^2.
 */
function calcolaAccelerazioneMinimiQuadrati(sequenza, Lcm) {
  if (!sequenza || sequenza.length !== 3 || !Lcm || Lcm <= 0) return 0;

  const L = Lcm;

  const dt1 = sequenza[0].rit / 1000.0;
  const dt2 = sequenza[1].rit / 1000.0;
  const dt3 = sequenza[2].rit / 1000.0;

  const t1 = dt1;
  const t2 = t1 + dt2;
  const t3 = t2 + dt3;

  const tempi = [t1, t2, t3];
  const spazi = [L, 2 * L, 3 * L];

  // Trasformazione lineare: y_i = s_i / t_i
  const y = [spazi[0] / t1, spazi[1] / t2, spazi[2] / t3];

  const meanT = (t1 + t2 + t3) / 3.0;
  const meanY = (y[0] + y[1] + y[2]) / 3.0;

  let num = 0;
  let den = 0;

  for (let i = 0; i < 3; i++) {
    const diffT = tempi[i] - meanT;
    num += diffT * (y[i] - meanY);
    den += diffT * diffT;
  }

  if (den === 0) return 0;

  const m = num / den; // Pendenza m = 1/2 * a
  const a = 2.0 * m;   // Accelerazione in cm/s^2

  return parseFloat(Number(a).toPrecision(4));
}

/**
 * Calcola le accelerazioni cinematiche e dei minimi quadrati in cm/s^2.
 */
function calcolaAccelerazioniCinematiche(sequenza, Lcm) {
  if (!sequenza || sequenza.length !== 3 || !Lcm || Lcm <= 0) {
    return { a12: "0.000", a23: "0.000", a13: "0.000", aMinQ: "0.000" };
  }

  const L = Lcm;

  const dt1 = sequenza[0].rit / 1000.0;
  const dt2 = sequenza[1].rit / 1000.0;
  const dt3 = sequenza[2].rit / 1000.0;

  if (dt1 <= 0 || dt2 <= 0 || dt3 <= 0) {
    return { a12: "0.000", a23: "0.000", a13: "0.000", aMinQ: "0.000" };
  }

  // Accelerazioni cinematiche (cm/s^2)
  const a12 = ((2.0 * L) / (dt1 + dt2)) * ((dt1 - dt2) / (dt1 * dt2));
  const a23 = ((2.0 * L) / (dt3 + dt2)) * ((dt2 - dt3) / (dt3 * dt2));

  const dtQ = dt1**2 - dt3**2;
  const delta = 1 + ((1/4) * dtQ / (dt1 * dt3))**2;
  const a13 = (8.0 * L / dtQ) * (Math.sqrt(delta) - 1);

  // Minimi Quadrati
  const aMinQ = calcolaAccelerazioneMinimiQuadrati(sequenza, Lcm);
/*
  console.log("L:",L);
  console.log("dt1:",dt1);
  console.log("dt2:",dt2);
  console.log("dt3:",dt3);
  console.log("a12:",a12);
  console.log("a13:",a13);
  console.log("a23:",a23);
  console.log("aMinQ:",aMinQ);
*/

  return {
    a12: a12,
    a13: a13,
    a23: a23,
    aMinQ: aMinQ
  };
}

/**
 * Calcola media e deviazione standard per un array di numeri
 */
function calcolaStatistiche(vettore) {
  if (!vettore || vettore.length === 0) return { media: 0, stdDev: 0 };

  const n = vettore.length;
  const somma = vettore.reduce((acc, val) => acc + val, 0);
  const media = somma / n;

  const sommaScartiSq = vettore.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
  const stdDev = Math.sqrt(sommaScartiSq / n);

  return {
    media: parseFloat(media.toFixed(3)),
    stdDev: parseFloat(stdDev.toFixed(3))
  };
}
