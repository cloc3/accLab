#include <WebUSB.h>
WebUSB WebUSBSerial(1 /* https:// */, "example.com/arduino/monitor");
#define WEBSerial WebUSBSerial

#define PULSANTE 2 
#define PAUSA_PULSANTE 50

const int pulsante = digitalPinToInterrupt(PULSANTE);
volatile bool eventoDisponibile = false;
volatile unsigned long istanteEvento;

void evento() {
  istanteEvento = millis();
  eventoDisponibile = true;
}

void setup()
{
  WebUSBSerial.begin(57600);
  pinMode(LED_BUILTIN_TX, OUTPUT);
  pinMode(PULSANTE, INPUT_PULLUP);
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
      mode = (c == '1'); // 1 = dark (FALLING), 0 = light (RISING)
      
      noInterrupts();
      eventoDisponibile = false;
      misuraAvviata = false; 
      EIFR = bit(pulsante);
      attachInterrupt(pulsante, evento, triggers[mode]);
      interrupts();
      
      WebUSBSerial.print("{\"status\":\"ready\", \"input\":\"");
      WebUSBSerial.print(stato[mode]);
      WebUSBSerial.print("\"}\n");
      WebUSBSerial.flush();
      
      abilitato = true;
    }
  }

  char str[64];
  if (eventoDisponibile) {
    noInterrupts();
    eventoDisponibile = false;
    unsigned long copiaIstanteEvento = istanteEvento;
    interrupts();
    
    if ((copiaIstanteEvento - istantePrecedente) > PAUSA_PULSANTE) { // Debounce
      if (abilitato) {
        
        if (!misuraAvviata) {
          // Fissa il punto zero all'inizio del primo oscuramento
          misuraAvviata = true;
        } else {
          // Invia il tempo trascorso durante lo stato appena completato
          sprintf(str, "{\"rit\":%ld, \"stato\":\"%s\"}\n",
                  istanteEvento - inizioMisura,
                  stato[mode]);

          digitalWrite(LED_BUILTIN_TX, LOW);
          WebUSBSerial.print(str);
          WebUSBSerial.flush();
          digitalWrite(LED_BUILTIN_TX, HIGH);
        }

        // Prepara l'evento successivo
        inizioMisura = istanteEvento;
        mode = !mode; 
        EIFR = bit(pulsante);
        attachInterrupt(pulsante, evento, triggers[mode]);
      }
      
      istantePrecedente = istanteEvento;
    }
  }
}
