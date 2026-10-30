#include <WebUSB.h>
WebUSB WebUSBSerial(1 /* https:// */, "example.com/arduino/monitor");
#define WEBSerial WebUSBSerial

#define PULSANTE 2 
#define PAUSA_PULSANTE 50
#define RITARDO 1000
const int pulsante = digitalPinToInterrupt(PULSANTE);
volatile bool eventoDisponibile = false;
volatile unsigned long istanteEvento;
byte triggerMODE = FALLING;

void evento() {
  istanteEvento=millis();
  eventoDisponibile = true;
}

void setup()
{
  //Serial.begin(57600);
  WebUSBSerial.begin(57600);

  pinMode(LED_BUILTIN_TX, OUTPUT);
  pinMode(PULSANTE, INPUT_PULLUP);
  attachInterrupt(pulsante, evento, triggerMODE);
 
  //delay(RITARDO);
  //Serial.println("System Ready. Usa il pulsante per misurare i ritardi.");
}

unsigned long istantePrecedente=0;
unsigned long inizioMisura;
unsigned long ultimoPing = 0;
bool abilitato = true;

void loop()
{
  if (WebUSBSerial.available()) {
    char c = WebUSBSerial.read();
    if (c == 'W') {
      // Resetta lo stato di misura quando la pagina web si collega ufficialmente
      noInterrupts();
      eventoDisponibile = false;
      triggerMODE = FALLING;
      EIFR = bit(pulsante);
      attachInterrupt(pulsante, evento, triggerMODE);
      interrupts();
      WebUSBSerial.print("{\"status\":\"ready\"}\n");
      WebUSBSerial.flush();
      abilitato = true;
  }
}
  char str[64];
  if (eventoDisponibile) {
    eventoDisponibile=false;
    if ((istanteEvento-istantePrecedente) > PAUSA_PULSANTE) { // Debounce
      if(triggerMODE == FALLING) {
        inizioMisura=istanteEvento;
        //Serial.println("avvio misura");
        triggerMODE=RISING;
        EIFR = bit(pulsante); //azzera l'Interrupt Flag eventualmente attivata da un evento spurio precedente.
        attachInterrupt(pulsante, evento, triggerMODE);
      } else {
        if (abilitato) {
          sprintf(str,"{\"rit\":%ld}\n",istanteEvento-inizioMisura);
          //Serial.println(str);
          digitalWrite(LED_BUILTIN_TX, LOW);
          WebUSBSerial.print(str);
          WebUSBSerial.flush();
          delay(50);
          digitalWrite(LED_BUILTIN_TX, HIGH);
          triggerMODE=FALLING;
          EIFR = bit(pulsante);
          attachInterrupt(pulsante, evento, triggerMODE);
        }
      }
    }
    istantePrecedente=istanteEvento;
  }
}
