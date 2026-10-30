#define PULSANTE 2 
#define PAUSA_PULSANTE 50
#define RITARDO 1000

bool azione = false;
void setup()
{
  Serial.begin(57600);

  pinMode(PULSANTE, INPUT_PULLUP);
 
  delay(5000);
  Serial.println("System Ready. Premi il pulsante per iniziare il test.");
}

void loop()
{
  if (digitalRead(PULSANTE) == LOW) {
    delay (PAUSA_PULSANTE); // Debounce
    Serial.print("pulsante premuto: ");
    Serial.println(digitalRead(PULSANTE));
    while(digitalRead(PULSANTE) == LOW);
    azione = true;
  }
  if (azione) {
    Serial.println("pulsante riconosciuto");
    azione=false;
  } else {
    Serial.println("in attesa");
  }
  delay(1000);
}
