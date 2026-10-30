#include <WebUSB.h>
WebUSB WebUSBSerial(1 /* https:// */, "example.com/arduino/monitor");
#define WEBSerial WebUSBSerial

#define FOTODIODO 2 
#define RITARDO_ANTIRIMBALZI 5
#define LED_EMETTITORE 4  // Pin digitale a cui collegare il LED IR emettitore

const int pulsante = digitalPinToInterrupt(FOTODIODO);
volatile bool eventoDisponibile = false;
volatile unsigned long istanteEvento;

void evento() {
  istanteEvento = millis();
  eventoDisponibile = true;
}

void setup()
{
  WebUSBSerial.begin(57600);
  
  // Spia di stato su Pro Micro (TX LED)
  pinMode(LED_BUILTIN_TX, OUTPUT);
  digitalWrite(LED_BUILTIN_TX, HIGH); // Inizialmente SPENTO (logica invertita)

  // Pin pilotaggio emettitore IR
  pinMode(LED_EMETTITORE, OUTPUT);
  digitalWrite(LED_EMETTITORE, LOW);  // Inizialmente SPENTO

  pinMode(FOTODIODO, INPUT);
}

unsigned long istantePrecedente = 0;
unsigned long inizioMisura;
bool abilitato = false;
bool misuraAvviata = false;
bool mode;

void loop()
{
  const byte triggers[] = { FALLING, RISING };
  const char* stato[] = { "light", "dark" };

  if (WebUSBSerial.available()) {
    char c = WebUSBSerial.read();
    
    if (c == '0' || c == '1') {
      mode = (c == '1'); // 1 = dark, 0 = light
      
      // Accende l'emettitore IR ed attiva la spia TX LED
      digitalWrite(LED_EMETTITORE, HIGH);
      digitalWrite(LED_BUILTIN_TX, LOW);  // LOW = ACCESO su Pro Micro

      noInterrupts();
      eventoDisponibile = false;
      misuraAvviata = false; 
      EIFR = bit(pulsante);  // Pulizia flag interrupt
      attachInterrupt(pulsante, evento, triggers[mode]);
      interrupts();
      
      WebUSBSerial.print("{\"status\":\"ready\", \"input\":\"");
      WebUSBSerial.print(stato[mode]);
      WebUSBSerial.print("\"}\n");
      WebUSBSerial.flush();
      
      abilitato = true;
    } 
    else if (c == '2') {
      // Spegne l'emettitore IR e disattiva la spia TX LED
      digitalWrite(LED_EMETTITORE, LOW);
      digitalWrite(LED_BUILTIN_TX, HIGH); // HIGH = SPENTO su Pro Micro

      noInterrupts();
      detachInterrupt(pulsante);
      eventoDisponibile = false;
      misuraAvviata = false;
      abilitato = false;
      interrupts();

      WebUSBSerial.print("{\"status\":\"off\"}\n");
      WebUSBSerial.flush();
    }
  }

  char str[64];
  if (eventoDisponibile) {
    // Protezione atomica della variabile volatile
    noInterrupts();
    unsigned long copiaIstanteEvento = istanteEvento;
    eventoDisponibile = false;
    interrupts();
    
    if ((copiaIstanteEvento - istantePrecedente) > RITARDO_ANTIRIMBALZI) { // Debounce
      if (abilitato) {
        
        if (!misuraAvviata) {
          // Fissa il punto zero al primo evento
          misuraAvviata = true;
        } else {
          // Invia il tempo trascorso usufruendo della copia atomica
          sprintf(str, "{\"rit\":%lu, \"stato\":\"%s\"}\n",
                  copiaIstanteEvento - inizioMisura,
                  stato[mode]);

          WebUSBSerial.print(str);
          WebUSBSerial.flush();
        }

        // Prepara l'evento successivo
        inizioMisura = copiaIstanteEvento;
        mode = !mode; 
        EIFR = bit(pulsante);  // Pulizia flag interrupt
        attachInterrupt(pulsante, evento, triggers[mode]);
      }
      
      istantePrecedente = copiaIstanteEvento;
    }
  }
}
