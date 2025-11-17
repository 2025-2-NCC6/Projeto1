/*
  Sistema de Automação de Sala de Aula V4 - Integrado com ESP8266
  Para: Arduino Mega

    FUNCIONALIDADES:
  1. Sistema RFID para Porta e 9 Carteiras (com feedback de LEDs e LCD)
  2. Contador de Pessoas Bidirecional (Sensores IR Calibrados)
  3. Automação via Relés (Ocupação e Professor)
  4. Calibração interativa dos sensores IR no início.

  --- MAPEAMENTO DE PINOS (Arduino Mega) ---
  [I2C] LCD SDA: 20 | LCD SCL: 21
  [SPI RFID] MISO: 50 | MOSI: 51 | SCK: 52 | SS: 53 | RST: 9
  [INTERFACE] Botão Esq: 28 | Botão Dir: 29
  [LEDS] 30 a 40
  [IR] Sensor 1: A3 | Sensor 2: A2
  [RELÉS] Sala ocupada: 4 | Professor: 5

*/

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// =========================================================================
// CONFIGURAÇÕES E PINOS
// =========================================================================
#define RST_PIN 9
#define SS_PIN 53
#define BLOCO_DADOS 1
#define BTN_ESQUERDA_PIN 38
#define BTN_DIREITA_PIN 37
const int PINO_IR1 = A3;
const int PINO_IR2 = A2;
const int PINO_RELE_OCUPADO = 4;
const int PINO_RELE_PROFESSOR = 5;

// =========================================================================
// OBJETOS E VARIÁVEIS GLOBAIS
// =========================================================================
MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

enum ModoSistema { MODO_LEITURA_SALA, MODO_ESCRITA, MODO_MENSAGEM_TEMP };
ModoSistema modoAtual = MODO_LEITURA_SALA;
ModoSistema modoAnterior = MODO_LEITURA_SALA;

enum Localizacao {
  STATE_PORTA, STATE_PROFESSOR,
  STATE_A1, STATE_A2, STATE_A3,
  STATE_B1, STATE_B2, STATE_B3,
  STATE_C1, STATE_C2, STATE_C3,
  TOTAL_LOCAIS
};
int localAtual = STATE_PORTA;
String nomesLocais[] = {
  "Porta da Sala", "Mesa Professor",
  "Carteira A1", "Carteira A2", "Carteira A3",
  "Carteira B1", "Carteira B2", "Carteira B3",
  "Carteira C1", "Carteira C2", "Carteira C3"
};
const int PINOS_LEDS[] = {39,40,49,48,47,46,45,44,43,42,41};

enum TipoFeedback { FEEDBACK_NENHUM, FEEDBACK_PORTA_DESTINO, FEEDBACK_OK, FEEDBACK_ERRO };
TipoFeedback tipoFeedbackAtual = FEEDBACK_NENHUM;
int ledDestinoIndex = -1, ledErroIndex = -1;

// --- DATABASE ---
#define TOTAL_PESSOAS 10
struct Pessoa { String nome; String carteira; int localIndex; String rfidTagId; };
Pessoa database[TOTAL_PESSOAS];
int indiceInscricao = 0;

int limiarIR1 = 100, limiarIR2 = 100, contadorPessoas = 0, estadoPassagem = 0;
bool estadoAtualSensor1 = false, ultimoEstadoSensor1 = false, estadoAtualSensor2 = false, ultimoEstadoSensor2 = false;
unsigned long tempoInicioPassagem = 0, ultimoTempoIR = 0;

bool releProfessorLigado = false;
unsigned long tempoInicioHold = 0, tempoUltimoAperto = 0, tempoInicioMensagem = 0, tempoUltimoResetRfid = 0;
bool holdJaAtivouToggle = false;
const long INTERVALO_RESET_RFID = 10000;
const int TEMPO_HOLD_BOTOES = 2000, TEMPO_DEBOUNCE = 200, TEMPO_MSG_LCD = 3000, TIMEOUT_PASSAGEM = 2000;

// =========================================================================
// SETUP
// =========================================================================
void setup() {
  Serial.begin(115200); // Serial para debug no PC
  // NOVO: Inicializa a comunicação com o ESP8266
  Serial3.begin(115200); 
  
  SPI.begin();
  mfrc522.PCD_Init();
  lcd.init();
  lcd.backlight();

  pinMode(BTN_ESQUERDA_PIN, INPUT_PULLUP);
  pinMode(BTN_DIREITA_PIN, INPUT_PULLUP);
  pinMode(PINO_IR1, INPUT);
  pinMode(PINO_IR2, INPUT);
  pinMode(PINO_RELE_OCUPADO, OUTPUT);
  pinMode(PINO_RELE_PROFESSOR, OUTPUT);

  digitalWrite(PINO_RELE_OCUPADO, LOW);
  digitalWrite(PINO_RELE_PROFESSOR, LOW);
  for (int i = 0; i < TOTAL_LOCAIS; i++) {
    pinMode(PINOS_LEDS[i], OUTPUT);
    digitalWrite(PINOS_LEDS[i], LOW);
  }

  inicializarDatabase();
  calibrarSensoresIR(); 

  Serial.println(F("--- SISTEMA INTEGRADO V4 (ARDUINO) INICIADO ---"));
  atualizarDisplay();
  atualizarLEDs();
}

// ALTERAÇÃO: Banco de dados com nomes e RFID_TAG_IDs reais.
void inicializarDatabase() {
  database[0] = {"Rodnil Rods",    "Mesa", STATE_PROFESSOR, "124578"};
  database[1] = {"Ana S. Silva",   "A1",   STATE_A1,        "RFID-TAG-ALUNA-001"};
  database[2] = {"Lara",           "A2",   STATE_A2,        "123456"};
  database[3] = {"Vitor Locateli", "A3",   STATE_A3,        "1234"};
  database[4] = {"Beatriz Costa",  "B1",   STATE_B1,        "AABB112233"};
  database[5] = {"Carlos Eduardo", "B2",   STATE_B2,        "RFID_DO_CARLOS"};
  database[6] = {"Bia",            "B3",   STATE_B3,        "515615"};
  database[7] = {"Joao Pedro",     "C1",   STATE_C1,        "123459"};
  database[8] = {"Gustavo M.",     "C2",   STATE_C2,        "vwijnvbierjw"};
  database[9] = {"Giulia Lopes",   "C3",   STATE_C3,        "cwkmoc"};
}

// --- Funções de Calibração, Animação e Loop (sem alterações) ---
// (O código de calibrarSensoresIR, animarLEDsCarregando, esperarBotaoDireito, 
// lerMedia, loop, gerenciarContagemPessoas permanece o mesmo da versão anterior)
// ... (cole aqui as funções da V3 que não mudaram para economizar espaço)
// =========================================================================
// ROTINA DE CALIBRAÇÃO IR E ANIMAÇÃO
// =========================================================================
void calibrarSensoresIR() {
  lcd.clear(); lcd.print(F("> CALIBRACAO IR <"));
  lcd.setCursor(0, 1); lcd.print(F("Btn DIR inicia"));
  esperarBotaoDireito();

  lcd.clear(); lcd.print(F("1.Deixe LIVRE"));
  lcd.setCursor(0, 1); lcd.print(F("e aperte DIR >>"));
  esperarBotaoDireito();
  
  lcd.clear(); lcd.print(F("Lendo..."));
  int livre1 = lerMedia(PINO_IR1, 50);
  int livre2 = lerMedia(PINO_IR2, 50);
  delay(500);

  lcd.clear(); lcd.print(F("2.BLOQUEIE ambos"));
  lcd.setCursor(0, 1); lcd.print(F("e aperte DIR >>"));
  esperarBotaoDireito();

  lcd.clear(); lcd.print(F("Lendo..."));
  int bloq1 = lerMedia(PINO_IR1, 50);
  int bloq2 = lerMedia(PINO_IR2, 50);

  limiarIR1 = (livre1 + bloq1) / 2;
  limiarIR2 = (livre2 + bloq2) / 2;

  lcd.clear();
  lcd.print(F("L1:")); lcd.print(limiarIR1);
  lcd.print(F(" L2:")); lcd.print(limiarIR2);
  lcd.setCursor(0,1); lcd.print(F("OK! Iniciando..."));
  
  Serial.print(F("CALIBRACAO IR COMPLETA. L1: ")); Serial.print(limiarIR1);
  Serial.print(F(" | L2: ")); Serial.print(limiarIR2); Serial.println();
  
  delay(3000);
}

void animarLEDsCarregando() {
  static unsigned long ultimoTempoAnimacao = 0;
  static int passoAnimacao = 0;
  const int INTERVALO_ANIMACAO = 100;
  
  const int sequencia[] = {STATE_A1, STATE_A2, STATE_A3, STATE_B3, STATE_C3, STATE_C2, STATE_C1, STATE_B1};
  const int totalPassos = sizeof(sequencia) / sizeof(int);

  if (millis() - ultimoTempoAnimacao > INTERVALO_ANIMACAO) {
    ultimoTempoAnimacao = millis();
    int passoAnterior = (passoAnimacao == 0) ? totalPassos - 1 : passoAnimacao - 1;
    digitalWrite(PINOS_LEDS[sequencia[passoAnterior]], LOW);
    digitalWrite(PINOS_LEDS[sequencia[passoAnimacao]], HIGH);
    passoAnimacao++;
    if (passoAnimacao >= totalPassos) passoAnimacao = 0;
  }
}

void esperarBotaoDireito() {
  delay(500); 
  while (digitalRead(BTN_DIREITA_PIN) == HIGH) {
    animarLEDsCarregando();
  }
  for(int i = 0; i < TOTAL_LOCAIS; i++) digitalWrite(PINOS_LEDS[i], LOW);
  while (digitalRead(BTN_DIREITA_PIN) == LOW);
}

int lerMedia(int pino, int amostras) {
  long soma = 0;
  for (int i = 0; i < amostras; i++) {
    soma += analogRead(pino);
    delay(5);
  }
  return (int)(soma / amostras);
}

void loop() {
  if (millis() - tempoUltimoResetRfid > INTERVALO_RESET_RFID) {
    mfrc522.PCD_Init(); tempoUltimoResetRfid = millis();
  }
  if (millis() - ultimoTempoIR >= 20) {
    gerenciarContagemPessoas(); ultimoTempoIR = millis();
  }
  switch (modoAtual) {
    case MODO_MENSAGEM_TEMP:
      atualizarLEDsFeedback();
      if (millis() - tempoInicioMensagem > TEMPO_MSG_LCD) {
        modoAtual = modoAnterior; tipoFeedbackAtual = FEEDBACK_NENHUM; atualizarDisplay(); atualizarLEDs();
      }
      break;
    case MODO_LEITURA_SALA: case MODO_ESCRITA:
      gerenciarBotoes(); gerenciarRFID(); break;
  }
}
void gerenciarContagemPessoas() {
  estadoAtualSensor1 = (analogRead(PINO_IR1) < limiarIR1);
  estadoAtualSensor2 = (analogRead(PINO_IR2) < limiarIR2);

  if (estadoPassagem == 0) {
    if (estadoAtualSensor1 && !ultimoEstadoSensor1) {
      estadoPassagem = 1; tempoInicioPassagem = millis();
    } else if (estadoAtualSensor2 && !ultimoEstadoSensor2) {
      estadoPassagem = 2; tempoInicioPassagem = millis();
    }
  } else if (estadoPassagem == 1 && estadoAtualSensor2 && !ultimoEstadoSensor2) {
    contadorPessoas++; Serial.print(F("ENTRADA. Total: ")); Serial.println(contadorPessoas); estadoPassagem = 0;
  } else if (estadoPassagem == 2 && estadoAtualSensor1 && !ultimoEstadoSensor1) {
    if (contadorPessoas > 0) contadorPessoas--;
    Serial.print(F("SAIDA. Total: ")); Serial.println(contadorPessoas); estadoPassagem = 0;
  }
  if (estadoPassagem != 0 && (millis() - tempoInicioPassagem > TIMEOUT_PASSAGEM)) {
    Serial.println(F("IR Timeout - Reset")); estadoPassagem = 0;
  }
  digitalWrite(PINO_RELE_OCUPADO, (contadorPessoas > 0) ? HIGH : LOW);
  ultimoEstadoSensor1 = estadoAtualSensor1; ultimoEstadoSensor2 = estadoAtualSensor2;
}

// =========================================================================
// FUNÇÕES PRINCIPAIS MODIFICADAS
// =========================================================================

// ALTERAÇÃO: A lógica principal foi refeita para se comunicar com o ESP8266
void processarLeituraSala() {
  byte buffer[18];
  byte size = sizeof(buffer);
  String tagLida = "";
  
  if (lerBloco(BLOCO_DADOS, buffer, size)) {
    buffer[16] = '\0'; // Garante que a string termina corretamente
    tagLida = String((char*)buffer);
    tagLida.trim();
  } else {
    // Se a leitura falhar, não faz nada.
    return;
  }

  // Encontra qual pessoa corresponde à tag lida
  int pessoaIndex = -1;
  for (int i = 0; i < TOTAL_PESSOAS; i++) {
    if (database[i].rfidTagId.equals(tagLida)) {
      pessoaIndex = i;
      break;
    }
  }

  // Prepara o display para feedback
  modoAnterior = MODO_LEITURA_SALA;
  modoAtual = MODO_MENSAGEM_TEMP;
  tempoInicioMensagem = millis();
  lcd.clear();
  ledDestinoIndex = -1;
  ledErroIndex = -1;
  
  bool tagReconhecida = (pessoaIndex != -1);

  if (tagReconhecida) {
    Serial.print("Tag Reconhecida: "); Serial.print(database[pessoaIndex].nome);
    Serial.print(" ("); Serial.print(tagLida); Serial.println(")");
  } else {
    Serial.print("Tag Desconhecida: "); Serial.println(tagLida);
  }
  
  switch (localAtual) {
    case STATE_PORTA:
      if (tagReconhecida) {
        lcd.print(F("Ola ")); lcd.print(database[pessoaIndex].nome);
        lcd.setCursor(0, 1); lcd.print(F("Sente em: ")); lcd.print(database[pessoaIndex].carteira);
        tipoFeedbackAtual = FEEDBACK_PORTA_DESTINO;
        ledDestinoIndex = database[pessoaIndex].localIndex;
        // Se for aluno na porta, envia comando para marcar presença
        if(pessoaIndex > 0) { // 0 é o professor
           String comando = "ALUNO:" + tagLida;
           Serial3.println(comando);
           Serial.print("Enviando para ESP: "); Serial.println(comando);
        }
      } else {
        lcd.print(F("Tag Desconhecida")); tipoFeedbackAtual = FEEDBACK_ERRO; ledErroIndex = STATE_PORTA;
      }
      break;
      
    case STATE_PROFESSOR:
      if (pessoaIndex == 0) { // Se a tag for do professor
        releProfessorLigado = !releProfessorLigado;
        digitalWrite(PINO_RELE_PROFESSOR, releProfessorLigado ? HIGH : LOW);
        lcd.print(F("Ola Prof.")); lcd.setCursor(0, 1);
        lcd.print(releProfessorLigado ? F("AULA INICIADA") : F("AULA ENCERRADA"));
        tipoFeedbackAtual = FEEDBACK_OK; ledDestinoIndex = STATE_PROFESSOR;
        // Envia comando para iniciar/terminar aula
        String comando = "PROF:" + tagLida;
        Serial3.println(comando);
        Serial.print("Enviando para ESP: "); Serial.println(comando);
      } else {
        lcd.print(F("Apenas Professor")); tipoFeedbackAtual = FEEDBACK_ERRO; ledErroIndex = STATE_PROFESSOR;
      }
      break;
      
    default: // Nas carteiras dos alunos
       int pessoaEsperadaIndex = -1;
       // Procura qual aluno deveria sentar aqui
       for(int i=1; i<TOTAL_PESSOAS; i++){
         if(database[i].localIndex == localAtual){
           pessoaEsperadaIndex = i;
           break;
         }
       }
       
       if (pessoaIndex == pessoaEsperadaIndex) {
         lcd.print(F("Bem-vindo(a)")); lcd.setCursor(0, 1); lcd.print(database[pessoaIndex].nome);
         tipoFeedbackAtual = FEEDBACK_OK; ledDestinoIndex = localAtual;
         // Envia comando para marcar presença
         String comando = "ALUNO:" + tagLida;
         Serial3.println(comando);
         Serial.print("Enviando para ESP: "); Serial.println(comando);
       } else {
         lcd.print(F("Local Errado!"));
         tipoFeedbackAtual = FEEDBACK_ERRO;
         ledErroIndex = -1;
         if (tagReconhecida) {
           ledDestinoIndex = database[pessoaIndex].localIndex;
         }
       }
      break;
  }
}

void gerenciarRFID() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) { mfrc522.PICC_HaltA(); return; }
  if (modoAtual == MODO_LEITURA_SALA) processarLeituraSala();
  else if (modoAtual == MODO_ESCRITA) processarInscricaoTag();
  mfrc522.PICC_HaltA(); mfrc522.PCD_StopCrypto1();
}

// ALTERAÇÃO: Agora grava o RFID_TAG_ID completo na tag.
void processarInscricaoTag() {
  String idParaGravar = database[indiceInscricao].rfidTagId;
  byte buffer[16];
  memset(buffer, ' ', 16); // Preenche o buffer com espaços para limpar dados antigos
  idParaGravar.getBytes(buffer, 16);
  
  modoAnterior = MODO_ESCRITA;
  modoAtual = MODO_MENSAGEM_TEMP;
  tempoInicioMensagem = millis();
  lcd.clear();
  
  if (escreverBloco(BLOCO_DADOS, buffer)) {
    lcd.print(F("Gravado!")); lcd.setCursor(0, 1); lcd.print(database[indiceInscricao].nome);
    Serial.print("Tag gravada para "); Serial.print(database[indiceInscricao].nome);
    Serial.print(" com ID: "); Serial.println(idParaGravar);
    tipoFeedbackAtual = FEEDBACK_OK; ledDestinoIndex = localAtual;
  } else {
    lcd.print(F("Erro Gravacao")); tipoFeedbackAtual = FEEDBACK_ERRO; ledErroIndex = localAtual;
    Serial.println("Erro ao gravar tag!");
  }
  
  indiceInscricao++;
  if (indiceInscricao >= TOTAL_PESSOAS) indiceInscricao = 0;
  // Atualiza o display para a próxima pessoa a ser inscrita
  atualizarDisplay();
}

// --- Funções de Navegação, Display e RFID (sem alterações críticas) ---
// ... (cole aqui as funções da V3 que não mudaram para economizar espaço)
void gerenciarBotoes() {
  bool btnEsq = (digitalRead(BTN_ESQUERDA_PIN) == LOW);
  bool btnDir = (digitalRead(BTN_DIREITA_PIN) == LOW);
  if (btnEsq && btnDir) {
    if (tempoInicioHold == 0) {
      tempoInicioHold = millis(); holdJaAtivouToggle = false; lcd.clear(); lcd.print(F("Segure..."));
    } else if (!holdJaAtivouToggle && (millis() - tempoInicioHold > TEMPO_HOLD_BOTOES)) {
      modoAtual = (modoAtual == MODO_LEITURA_SALA) ? MODO_ESCRITA : MODO_LEITURA_SALA;
      if (modoAtual == MODO_ESCRITA) {
        indiceInscricao = 0; // Reinicia a inscrição
      }
      holdJaAtivouToggle = true; atualizarDisplay(); atualizarLEDs();
    }
  } else {
    if (tempoInicioHold != 0 && !holdJaAtivouToggle) { atualizarDisplay(); atualizarLEDs(); }
    tempoInicioHold = 0;
    if (millis() - tempoUltimoAperto < TEMPO_DEBOUNCE) return;
    if (btnEsq && !btnDir) { tempoUltimoAperto = millis(); if (modoAtual == MODO_LEITURA_SALA) navegarLocais(-1); else navegarInscricao(-1); }
    else if (btnDir && !btnEsq) { tempoUltimoAperto = millis(); if (modoAtual == MODO_LEITURA_SALA) navegarLocais(1); else navegarInscricao(1); }
  }
}

void navegarLocais(int direcao) {
  localAtual += direcao; if (localAtual >= TOTAL_LOCAIS) localAtual = 0; else if (localAtual < 0) localAtual = TOTAL_LOCAIS - 1;
  atualizarDisplay(); atualizarLEDs();
}

void navegarInscricao(int direcao) {
  indiceInscricao += direcao; if (indiceInscricao >= TOTAL_PESSOAS) indiceInscricao = 0; else if (indiceInscricao < 0) indiceInscricao = TOTAL_PESSOAS - 1;
  atualizarDisplay();
}

void atualizarDisplay() {
  lcd.clear();
  if (modoAtual == MODO_LEITURA_SALA) {
    lcd.print(nomesLocais[localAtual]); lcd.setCursor(0, 1);
    if (localAtual == STATE_PORTA) {
      lcd.print(F("< Aproxime Tag >"));
    } else {
      int db_index = -1;
      if (localAtual == STATE_PROFESSOR) db_index = 0;
      else {
        for(int i=1; i<TOTAL_PESSOAS; i++){ if(database[i].localIndex == localAtual){ db_index = i; break; } }
      }
      if (db_index != -1) lcd.print(database[db_index].nome);
    }
  } else if (modoAtual == MODO_ESCRITA) {
    lcd.print(F("Matricular Tag:")); lcd.setCursor(0, 1); lcd.print(database[indiceInscricao].nome);
  }
}

void atualizarLEDs() { for (int i = 0; i < TOTAL_LOCAIS; i++) digitalWrite(PINOS_LEDS[i], (i == localAtual) ? HIGH : LOW); }

void atualizarLEDsFeedback() {
  unsigned long m = millis();
  for (int i = 0; i < TOTAL_LOCAIS; i++) digitalWrite(PINOS_LEDS[i], LOW);
  if (ledDestinoIndex != -1) {
    int vel = (tipoFeedbackAtual == FEEDBACK_OK) ? 100 : 300;
    digitalWrite(PINOS_LEDS[ledDestinoIndex], (m % (vel * 2)) < vel ? HIGH : LOW);
  }
  if (ledErroIndex != -1) digitalWrite(PINOS_LEDS[ledErroIndex], (m % 2000) < 1000 ? HIGH : LOW);
}

bool lerBloco(byte b, byte* buf, byte s) {
  MFRC522::MIFARE_Key k; for (byte i=0; i<6; i++) k.keyByte[i]=0xFF;
  if (mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, (b/4)*4+3, &k, &(mfrc522.uid)) != MFRC522::STATUS_OK) return false;
  return (mfrc522.MIFARE_Read(b, buf, &s) == MFRC522::STATUS_OK);
}

bool escreverBloco(byte b, byte* d) {
  MFRC522::MIFARE_Key k; for (byte i=0; i<6; i++) k.keyByte[i]=0xFF;
  if (mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, (b/4)*4+3, &k, &(mfrc522.uid)) != MFRC522::STATUS_OK) return false;
  return (mfrc522.MIFARE_Write(b, d, 16) == MFRC522::STATUS_OK);
}