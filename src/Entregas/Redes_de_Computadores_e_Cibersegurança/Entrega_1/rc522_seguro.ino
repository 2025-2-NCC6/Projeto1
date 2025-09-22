#include <SPI.h>
#include <MFRC522.h>
#include <string.h> // strlen()

#define DEBUG  0   // 1 = logs de teste; 0 = produção
#define ENROLL 0   // 1 = imprime hash para cadastro no Serial

// Pinos (Arduino UNO): RC522 em SPI; periféricos opcionais para feedback
const uint8_t PIN_SS=10, PIN_RST=9, PIN_LED_OK=6, PIN_LED_NO=5, PIN_BUZZER=4, PIN_TAMPER=7;
MFRC522 r(PIN_SS, PIN_RST);

const char* SALT = "sala2025@protecao";

// Adicione aqui os hashes autorizados (formato 0xXXXXXXXX)
uint32_t WL[] = {
  0xFE2AF2B7, // exemplo
  0x9C1123A5  // exemplo
};
const size_t WLN = sizeof(WL)/sizeof(WL[0]);

// Janelas/limites
const unsigned long AP_MS = 15000UL;  // anti-passback
const uint8_t       FAIL_LIM = 5;     // falhas por janela
const unsigned long WIN_MS  = 30000UL;// janela de contagem
const unsigned long BLK_MS  = 60000UL;// bloqueio

// Estado
unsigned long lastOKms = 0, winStart = 0, blockUntil = 0;
uint32_t lastHash = 0;
uint8_t  fails = 0;

inline uint32_t fnv1a_init(){ return 0x811C9DC5UL; }
inline uint32_t fnv1a_upd(uint32_t h, uint8_t b){ h^=b; h*=16777619UL; return h; }
uint32_t hash_uid_salt(const MFRC522::Uid &u){
  uint32_t h = fnv1a_init();
  for(byte i=0;i<u.size;++i) h = fnv1a_upd(h, u.uidByte[i]);
  for(size_t i=0;i<strlen(SALT);++i) h = fnv1a_upd(h, (uint8_t)SALT[i]);
  return h;
}
bool in_wl(uint32_t h){
  for(size_t i=0;i<WLN;++i) if(WL[i]==h) return true;
  return false;
}

// Feedback simples (LED + buzzer)
void tone_ok(){ digitalWrite(PIN_LED_OK, HIGH); tone(PIN_BUZZER,1800,100); delay(120); digitalWrite(PIN_LED_OK,LOW); }
void tone_no(){ digitalWrite(PIN_LED_NO, HIGH);  tone(PIN_BUZZER, 600,300); delay(320); digitalWrite(PIN_LED_NO,LOW); }

void setup(){
  pinMode(PIN_LED_OK,OUTPUT); pinMode(PIN_LED_NO,OUTPUT);
  pinMode(PIN_BUZZER,OUTPUT); pinMode(PIN_TAMPER,INPUT_PULLUP);
  digitalWrite(PIN_LED_OK,LOW); digitalWrite(PIN_LED_NO,LOW);

  Serial.begin(115200);
  SPI.begin(); r.PCD_Init();

  winStart = millis();
#if DEBUG
  Serial.println("RC522 pronto");
#endif
}

void loop(){
  const unsigned long now = millis();

  // Tamper: LOW = violação detectada
  if(digitalRead(PIN_TAMPER)==LOW){
#if DEBUG
    Serial.println("TAMPER");
#endif
    for(int i=0;i<2;i++){ tone_no(); delay(120); }
  }

  // Bloqueio ativo (rate-limit)
  if(now < blockUntil){
    digitalWrite(PIN_LED_NO, (now/250)%2); // pisca para indicar bloqueio
    return;
  } else {
    digitalWrite(PIN_LED_NO, LOW);
  }

  // Renova a janela de contagem de falhas
  if(now - winStart > WIN_MS){ winStart = now; fails = 0; }

  // Aguarda cartão
  if(!r.PICC_IsNewCardPresent() || !r.PICC_ReadCardSerial()) return;

  uint32_t h = hash_uid_salt(r.uid);

#if ENROLL
  Serial.print("HASH 0x"); Serial.println(h, HEX);
#endif

  // Anti-passback (mesma credencial em intervalo curto)
  if(h==lastHash && (now - lastOKms) < AP_MS){
#if DEBUG
    Serial.println("AP negado");
#endif
    tone_no();
    r.PICC_HaltA(); r.PCD_StopCrypto1();
    return;
  }

  if(in_wl(h)){
    lastHash = h; lastOKms = now;
#if DEBUG
    Serial.println("OK");
#endif
    tone_ok();
  } else {
    fails++;
#if DEBUG
    Serial.print("NEG "); Serial.println(fails);
#endif
    if(fails >= FAIL_LIM){
      blockUntil = now + BLK_MS;
#if DEBUG
      Serial.println("BLOQUEIO");
#endif
    }
    tone_no();
  }

  // Encerra sessão com o cartão
  r.PICC_HaltA();
  r.PCD_StopCrypto1();
}
