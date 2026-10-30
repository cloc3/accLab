#define INTERRUPT 2
#define ALIMENTAZIONE 4
#define LUCCIOLA_ROSSA 9
#define LUCCIOLA_BLU 9
#define ANALOG A0
#define RITARDO 100

volatile byte stato = LOW;
void notifica() {
  stato = !stato;
}

void setup()
{
  Serial.begin(57600);

  pinMode(INTERRUPT, INPUT);
  pinMode(ALIMENTAZIONE, OUTPUT);
  pinMode(LUCCIOLA_ROSSA, OUTPUT);
  pinMode(LUCCIOLA_BLU, OUTPUT);
  digitalWrite(ALIMENTAZIONE,HIGH);
  attachInterrupt(digitalPinToInterrupt(INTERRUPT),notifica,RISING); 
}

void loop()
{
  /*
  Serial.print("stato: ");
  Serial.println(stato);
  */
  if (stato == LOW) {
    Serial.print("rosso: ");
    Serial.print(digitalRead(INTERRUPT));
    Serial.print("rosso: ");
    Serial.print("; analogico: ");
    Serial.println(analogRead(ANALOG));
    delay(RITARDO);
    /*
    digitalWrite(LUCCIOLA_ROSSA,HIGH);
    delay(RITARDO);
    digitalWrite(LUCCIOLA_ROSSA,LOW);
    delay(RITARDO);
    */
  } else {
    Serial.print("blu: ");
    Serial.println(digitalRead(INTERRUPT));
    Serial.print("; analogico: ");
    Serial.println(analogRead(ANALOG));
    delay(RITARDO);
    /*
    digitalWrite(LUCCIOLA_BLU,HIGH);
    delay(RITARDO);
    digitalWrite(LUCCIOLA_BLU,LOW);
    delay(RITARDO);
    */
  }
}
