void setup() {
  pinMode(LED_BUILTIN_TX, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN_TX, LOW);   // Accende il LED (su molte schede è attivo basso)
  delay(1000);
  digitalWrite(LED_BUILTIN_TX, HIGH);  // Spegne il LED
  delay(1000);
}
