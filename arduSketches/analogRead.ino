#include <WebUSB.h>
WebUSB WebUSBSerial(1 /* https:// */, "example.com/arduino/monitor");
//#define Serial WebUSBSerial

/*
  programma che legge un input analogico e scrive il risultato sul monitor
 */
#define ANALOG 0

void setup() {
  Serial.begin(57600);
  WebUSBSerial.begin(57600);
  pinMode(ANALOG,INPUT);
}

char str[64];
int vIN;
void loop() {
  vIN=analogRead(ANALOG);
  sprintf(str,"{\"v\":%d}\n",vIN);
  WebUSBSerial.print(str);
  WebUSBSerial.flush();
  Serial.println(vIN);
  delay(1000);
}
