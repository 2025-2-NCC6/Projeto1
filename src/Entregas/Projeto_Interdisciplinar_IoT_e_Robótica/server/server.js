const dgram = require("dgram");
const fs = require("fs");

// Cria o socket UDP
const server = dgram.createSocket("udp4");

// Configurações locais
const LISTEN_HOST = "0.0.0.0";
const LISTEN_PORT = 41234;

// Configurações do destino
const TARGET_HOST = "121.128.1.100";
const TARGET_PORT = 5000;

// Arquivo CSV
const CSV_FILE = "mensagens.csv";

// Se não existir, cria com cabeçalho
if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, "ID,Mensagem\n");
}

// Contador de mensagens
let id = 1;

// Quando chega mensagem
server.on("message", (msg, rinfo) => {
  console.log(`Recebida: ${msg} de ${rinfo.address}:${rinfo.port}`);

  // Salva no CSV
  const linha = `${id},"${msg.toString().replace(/"/g, '""')}"\n`;
  fs.appendFileSync(CSV_FILE, linha);
  console.log(`Salva no CSV com ID ${id}`);

  id++;

  // Responde ao destino
  const resposta = Buffer.from("Hello from UDP server!");
  server.send(resposta, TARGET_PORT, TARGET_HOST, (err) => {
    if (err) {
      console.error("Erro ao enviar:", err);
    } else {
      console.log(`Resposta enviada para ${TARGET_HOST}:${TARGET_PORT}`);
    }
  });
});

// Quando o servidor inicia
server.on("listening", () => {
  const addr = server.address();
  console.log(`Servidor ouvindo em ${addr.address}:${addr.port}`);
});

// Tratamento de erros
server.on("error", (err) => {
  console.error("Erro no servidor:", err);
  server.close();
});

// Inicia
server.bind(LISTEN_PORT, LISTEN_HOST);
