// --- Pinos ---
const int pinoRec1 = A3; // Sensor 1
const int pinoRec2 = A2; // Sensor 2
const int pinoLed = 4;   // LED que indica se a sala está ocupada

// --- Parâmetros de Detecção ---
const int LIMIAR = 100; // Desobstruido fica em torno de 300, bloqueado cai para menos de 30, então 100 é seguro

// --- Variáveis de Lógica e Estado ---
int contadorPessoas = 0;

// Estados ATUAIS dos sensores: false = livre, true = bloqueado
bool estadoAtualSensor1 = false;
bool estadoAtualSensor2 = false;

// Estados ANTERIORES dos sensores (para detectar a mudança)
bool ultimoEstadoSensor1 = false;
bool ultimoEstadoSensor2 = false;

// Variável para controlar a sequência de passagem
// 0: Ninguém passando, sistema pronto
// 1: Aguardando o sensor 2 ser bloqueado (iniciou uma entrada)
// 2: Aguardando o sensor 1 ser bloqueado (iniciou uma saída)
int estadoPassagem = 0;

// Controle de tempo para evitar detecções falsas ou sequências travadas
unsigned long tempoInicioPassagem;
const long TIMEOUT_PASSAGEM = 2000; // 2 segundos de tempo máximo para cruzar os dois sensores (por enquanto de teste, vamos ajustar )

void setup() {
  Serial.begin(9600);
  
  pinMode(pinoRec1, INPUT);
  pinMode(pinoRec2, INPUT);
  pinMode(pinoLed, OUTPUT);
  
  digitalWrite(pinoLed, LOW);
  
  Serial.println("Sistema de Contagem de Pessoas - V2 Robusto - Iniciado");
  Serial.print("Pessoas na sala: ");
  Serial.println(contadorPessoas);
  Serial.println("------------------------------------");
}

void loop() {
  // 1. Leitura dos sensores e definição do estado ATUAL
  estadoAtualSensor1 = (analogRead(pinoRec1) < LIMIAR);
  estadoAtualSensor2 = (analogRead(pinoRec2) < LIMIAR);

  // 2. Lógica principal baseada na MUDANÇA de estado (de livre para bloqueado)

  // Se estivermos esperando o início de uma passagem (estado 0)
  if (estadoPassagem == 0) {
    // Se o sensor 1 ACABOU de ser bloqueado (antes estava livre)
    if (estadoAtualSensor1 && !ultimoEstadoSensor1) {
      estadoPassagem = 1; // Sequência de ENTRADA iniciada
      tempoInicioPassagem = millis();
      Serial.println("=> Sequência de ENTRADA iniciada (Sensor 1 bloqueado)...");
    }
    // Senão, se o sensor 2 ACABOU de ser bloqueado
    else if (estadoAtualSensor2 && !ultimoEstadoSensor2) {
      estadoPassagem = 2; // Sequência de SAÍDA iniciada
      tempoInicioPassagem = millis();
      Serial.println("<= Sequência de SAÍDA iniciada (Sensor 2 bloqueado)...");
    }
  }

  // Se uma sequência de ENTRADA já começou (estado 1)
  else if (estadoPassagem == 1) {
    // E o sensor 2 ACABOU de ser bloqueado
    if (estadoAtualSensor2 && !ultimoEstadoSensor2) {
      contadorPessoas++;
      Serial.print("ENTROU UMA PESSOA! Total na sala: ");
      Serial.println(contadorPessoas);
      // Reseta o sistema para a próxima pessoa
      estadoPassagem = 0; 
      Serial.println("...Sistema pronto para nova contagem.");
      Serial.println("------------------------------------");
    }
  }
  
  // Se uma sequência de SAÍDA já começou (estado 2)
  else if (estadoPassagem == 2) {
    // E o sensor 1 ACABOU de ser bloqueado
    if (estadoAtualSensor1 && !ultimoEstadoSensor1) {
      if (contadorPessoas > 0) {
        contadorPessoas--;
      }
      Serial.print("SAIU UMA PESSOA! Total na sala: ");
      Serial.println(contadorPessoas);
      // Reseta o sistema para a próxima pessoa
      estadoPassagem = 0;
      Serial.println("...Sistema pronto para nova contagem.");
      Serial.println("------------------------------------");
    }
  }

  // 3. Lógica de Timeout
  // Se uma passagem começou mas não terminou em um tempo razoável
  if ((estadoPassagem == 1 || estadoPassagem == 2) && (millis() - tempoInicioPassagem > TIMEOUT_PASSAGEM)) {
    Serial.println("!!! TIMEOUT: A passagem não foi completada. Resetando sistema.");
    Serial.println("------------------------------------");
    estadoPassagem = 0; // Reseta a máquina de estados
  }

  // 4. Controle do LED
  if (contadorPessoas > 0) {
    digitalWrite(pinoLed, HIGH);
  } else {
    digitalWrite(pinoLed, LOW);
  }

  // 5. ATUALIZAÇÃO DOS ESTADOS ANTERIORES - ESSENCIAL!
  // Prepara as variáveis para a próxima iteração do loop
  ultimoEstadoSensor1 = estadoAtualSensor1;
  ultimoEstadoSensor2 = estadoAtualSensor2;

  delay(20); // Um pequeno delay para estabilidade
}