#include <WebUSB.h>
WebUSB WebUSBSerial(1 /* https:// */, "example.com/arduino/monitor");
#define WEBSerial WebUSBSerial

#define PULSANTE 2 
#define PAUSA_PULSANTE 50
#define RITARDO 1000

volatile bool eventoDisponibile = false;
volatile bool pulsantePremuto; // PULSANTE PREMUTO=true, PULSANTE LIBERO=false
volatile unsigned long istanteAttuale;

void evento() {
  istanteAttuale=millis();
  if (digitalRead(PULSANTE) == LOW) pulsantePremuto=true;
  else pulsantePremuto=false;
  eventoDisponibile = true;
}

void setup()
{
  Serial.begin(57600);
  WebUSBSerial.begin(57600);

  pinMode(PULSANTE, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSANTE), evento, CHANGE);
 
  delay(RITARDO);
  Serial.println("System Ready. Premi il pulsante per iniziare il test.");
}

unsigned long istanteIniziale=0;
unsigned long ritardo;
bool misuraInCorso = false;

void loop()
{
  if (eventoDisponibile) {
    noInterrupts();

    ritardo=istanteAttuale-istanteIniziale;
    istanteIniziale=istanteAttuale;
    eventoDisponibile=0;
    if (ritardo > PAUSA_PULSANTE) { // Debounce
      if (pulsantePremuto) {
      if (!misuraInCorso) {
          misuraInCorso=true;
          Serial.println("\tavvio misura");
          eventoDisponibile=false;
        }
      } else {
        if (misuraInCorso) {
         Serial.print("\tritardo rilevato: ");
          Serial.println(ritardo);
          WebUSBSerial.println(ritardo);
          WebUSBSerial.flush();
          eventoDisponibile=false;
          misuraInCorso=false;
        }
      }
    }
    interrupts();
  }
}
