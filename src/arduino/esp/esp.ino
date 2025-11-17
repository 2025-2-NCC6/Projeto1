#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// --- CONFIGURAÇÕES DA REDE (ALTERE AQUI) ---
const char* ssid = "BENETTI";
const char* password = "lu040505";

// --- CONFIGURAÇÕES DO SERVIDOR (ALTERE AQUI) ---
const char* serverIP = "192.168.0.172"; // IP do computador rodando o servidor
const int serverPort = 4000;
const int ROOM_ID = 1; // ID fixo desta sala
const int led = 4;

void setup() {
  // Serial padrão usada para comunicação com o Arduino Mega
  Serial.begin(115200);

  // LED onboard para feedback visual
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(led, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // LED apagado (LOW acende)

  piscarLED(5, 200);
  // Conectar ao Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_BUILTIN, LOW); delay(250);
    digitalWrite(LED_BUILTIN, HIGH); delay(250);
  }
  digitalWrite(LED_BUILTIN, LOW); // LED aceso = Conectado
  piscarLED(10, 100);
  testarConexaoServidor();
}

void loop() {
  // Verifica se há dados chegando do Arduino
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.length() > 0) {
      // Separa o comando em TIPO e DADO
      int separatorIndex = command.indexOf(':');
      if (separatorIndex > 0) {
        String type = command.substring(0, separatorIndex);
        String rfidTag = command.substring(separatorIndex + 1);

        if (type.equals("PROF")) {
          iniciarAula(rfidTag);
        } else if (type.equals("ALUNO")) {
          marcarPresenca(rfidTag);
        }
      }
    }
  }
}

void piscarLED(int vezes, int duracao) {
  digitalWrite(led, LOW); // Garante que começa aceso
  for(int i=0; i<vezes; i++){
    digitalWrite(led, HIGH); delay(duracao);
    digitalWrite(led, LOW); delay(duracao);
  }
}

void iniciarAula(String rfidTag) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  WiFiClient client;
  HTTPClient http;
  String serverPath = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/rfid/iniciar-aula";

  http.begin(client, serverPath);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<100> jsonDoc;
  jsonDoc["rfid_tag_id"] = rfidTag;
  String requestBody;
  serializeJson(jsonDoc, requestBody);
  
  piscarLED(3, 50); // Piscada rápida = Enviando requisição

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode == 200) {
    piscarLED(2, 500); // Piscada lenta = Sucesso
  } else {
    piscarLED(5, 100); // Piscada muito rápida = Erro
  }
  
  http.end();
}

void marcarPresenca(String rfidTag) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String serverPath = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/rfid/marcar-presenca";

  http.begin(client, serverPath);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<150> jsonDoc;
  jsonDoc["rfid_tag_id"] = rfidTag;
  jsonDoc["room_id"] = ROOM_ID;
  String requestBody;
  serializeJson(jsonDoc, requestBody);

  piscarLED(3, 50); // Piscada rápida = Enviando requisição

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode == 201) { // 201 Created é o sucesso para esta rota
    piscarLED(2, 500); // Piscada lenta = Sucesso
  } else {
    piscarLED(5, 100); // Piscada muito rápida = Erro
  }

  http.end();
}

void testarConexaoServidor() {
  Serial.println("\n--- Iniciando teste de conexao com o servidor ---");
  
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;
    
    // Usamos uma rota GET simples que deve existir no seu servidor
    String serverPath = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/rooms";
    Serial.print("Tentando acessar: ");
    Serial.println(serverPath);
    
    http.begin(client, serverPath);
    
    // Faz a requisição GET
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      Serial.print(">>> SUCESSO: O servidor respondeu com o codigo: ");
      Serial.println(httpResponseCode);
      
      String payload = http.getString();
      Serial.println("Resposta do servidor:");
      Serial.println(payload);
      piscarLED(10, 100);

    } else {
      Serial.print(">>> FALHA: Erro na requisicao HTTP. Codigo: ");
      Serial.println(httpResponseCode);
      Serial.println("Verifique se o IP do servidor esta correto e se o servidor esta rodando.");
    }
    
    http.end();
  } else {
    Serial.println(">>> FALHA: Sem conexao WiFi para testar o servidor.");
    piscarLED(5, 200);
  }
}