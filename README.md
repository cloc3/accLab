# accLab: un laboratorio per le accelerazioni

Un carrello transita davanti a una fotocellula trasportando due cartellini separati da uno sapzio vuoto.
La fotocellula dialoga via WebUSB con un microcontroller ATmega32U4 (Arduino Leonardo o proMicro della SparkFun) per misurare i tempi di volo.

Il sistema assume che gli spazi di volo siano tutti e tre uguali (lunghezza personalizzabile in unità di misura arbitrarie), calcola le velocità medie e l' accelerazione media.
Per l'accelerazione sono utilizzati quattro algoritmi di stima differenti.
Il più affidiabilie utilizza il metodo dei minimi quadrati.
Gli altri tre calcolano l'accelerazione utilizzando soltanto due delle tre misure di tempo.

Il sistema permette di accumulare statistica per realizzare prove ripetute e calcola i valori medi e gli errori assoluti e relativi.
È possibile valutare l'elaborazione statistica utilizzando l'intero set della misure acquisite o un suo sottoinsieme.
È possibile scartare le misure ritenute non affidabili.
È possibile scaricare i dati acquisiti informato json o in formato csv.
È possibile aggiungere dati o sovrascrivere un set di misure esistenti acquisendo un file in formato json.
Ci sono accessi riservati per acquisire misure di test.

La grafica consente la presenza contemporanea di più sessioni che utilizzano lo stesso set di dati e si sincronizzano contemporaneamente. per esempio, è possibile eseguire la misura con una macchina collegata ad arduino e, contemporaneamente, osservare i ricultati su una pagina web indipendente di un secondo computer.

Attualmente, il sistema consente di proposito l'accesso senza autenticazione, ma potrebbe essere modificato in caso di abusi che ne rendano impossibile l'utilizzo.

