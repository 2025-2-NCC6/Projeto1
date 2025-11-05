// --- server.js (Versão Completa e Segura) ---

// 1. Importar as bibliotecas
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // <-- Importamos a biblioteca de criptografia

// 2. Configurações Iniciais
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4000;
const dbPath = path.join(__dirname, 'automacao.db');

// 3. Conectar ao Banco de Dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) {
        console.error('Erro ao ativar chaves estrangeiras:', err.message);
      } else {
        console.log('Chaves estrangeiras ativadas.');
      }
    });
  }
});

// --- 4. Rotas de Autenticação (Com Criptografia) ---

/**
 * Rota para REGISTRAR um novo usuário (Aluno, Professor, etc.)
 * Recebe a senha em texto plano, cria o HASH e salva no banco.
 */
app.post('/api/register', async (req, res) => {
  const { name, email, password, rfid_tag_id, role } = req.body;

  if (!name || !email || !password || !rfid_tag_id || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Gerar o "sal" e criar o hash da senha
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const sql = `INSERT INTO Users (name, email, password_hash, rfid_tag_id, role) 
                 VALUES (?, ?, ?, ?, ?)`;
    // Note que salvamos o 'password_hash', e não a senha original
    const params = [name, email, password_hash, rfid_tag_id, role];

    db.run(sql, params, function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({
        message: 'Usuário criado com sucesso!',
        userId: this.lastID
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar o registro.' });
  }
});

/**
 * Rota para LOGIN
 * Recebe email e senha, compara a senha com o HASH salvo no banco.
 */
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const sql = "SELECT * FROM Users WHERE email = ?";

  // db.get() é para pegar UM ÚNICO item
  db.get(sql, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Se o usuário não for encontrado...
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Usuário encontrado, agora comparar as senhas
    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }

      // Se deu tudo certo!
      res.json({
        message: 'Login bem-sucedido!',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
        // Em um app real, aqui você geraria um Token JWT
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao processar o login.' });
    }
  });
});


// --- 5. Rotas CRUD (Completas) ---

// ----------------------------------------------------------------
// --- Tabela: Users (Gerenciamento)
// ----------------------------------------------------------------
// GET /api/users - Pega todos os usuários (sem a senha)
app.get('/api/users', (req, res) => {
  db.all("SELECT id, name, email, rfid_tag_id, role FROM Users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/users/:id - Pega um usuário (sem a senha)
app.get('/api/users/:id', (req, res) => {
  db.get("SELECT id, name, email, rfid_tag_id, role FROM Users WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(row);
  });
});

// PUT /api/users/:id - Atualiza um usuário
app.put('/api/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  // Nota: Não estamos permitindo atualizar senha ou rfid por aqui por simplicidade
  const sql = "UPDATE Users SET name = ?, email = ?, role = ? WHERE id = ?";
  db.run(sql, [name, email, role, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Usuário atualizado com sucesso.', changes: this.changes });
  });
});

// DELETE /api/users/:id - Deleta um usuário
app.delete('/api/users/:id', (req, res) => {
  db.run("DELETE FROM Users WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Usuário deletado com sucesso.', changes: this.changes });
  });
});

// ----------------------------------------------------------------
// --- Tabela: Courses (Cursos/Disciplinas)
// ----------------------------------------------------------------
app.post('/api/courses', (req, res) => {
  const { name, professor_id } = req.body;
  db.run("INSERT INTO Courses (name, professor_id) VALUES (?, ?)", [name, professor_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, professor_id });
  });
});

app.get('/api/courses', (req, res) => {
  // JOIN para já trazer o nome do professor
  const sql = `
    SELECT c.id, c.name, c.professor_id, u.name as professor_name 
    FROM Courses c
    JOIN Users u ON c.professor_id = u.id
    WHERE u.role = 'Professor'`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/courses/:id', (req, res) => {
  db.get("SELECT * FROM Courses WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Curso não encontrado.' });
    res.json(row);
  });
});

app.put('/api/courses/:id', (req, res) => {
  const { name, professor_id } = req.body;
  db.run("UPDATE Courses SET name = ?, professor_id = ? WHERE id = ?", [name, professor_id, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Curso não encontrado.' });
    res.json({ message: 'Curso atualizado com sucesso.' });
  });
});

app.delete('/api/courses/:id', (req, res) => {
  db.run("DELETE FROM Courses WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Curso não encontrado.' });
    res.json({ message: 'Curso deletado com sucesso.' });
  });
});

// ----------------------------------------------------------------
// --- Tabela: Rooms (Salas e Automação)
// ----------------------------------------------------------------
app.post('/api/rooms', (req, res) => {
  const { name, status } = req.body;
  db.run("INSERT INTO Rooms (name, status) VALUES (?, ?)", [name, status || 'Livre'], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, status: status || 'Livre' });
  });
});

app.get('/api/rooms', (req, res) => {
  db.all("SELECT * FROM Rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/rooms/:id', (req, res) => {
  db.get("SELECT * FROM Rooms WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Sala não encontrada.' });
    res.json(row);
  });
});

// Rota principal da sua automação!
app.put('/api/rooms/status/:id', (req, res) => {
  // Adiciona 'lighting_scene' se você quiser salvar os botões (Apresentação, Leitura, etc)
  const { status, current_course_id, lighting_intensity, ac_temperature, ac_on /*, lighting_scene */ } = req.body;

  // Converte true/false do JS para 1/0 do SQLite
  const acOnValue = ac_on === true ? 1 : (ac_on === false ? 0 : null);

  const sql = `UPDATE Rooms SET 
               status = COALESCE(?, status), 
               current_course_id = COALESCE(?, current_course_id), 
               lighting_intensity = COALESCE(?, lighting_intensity), 
               ac_temperature = COALESCE(?, ac_temperature), 
               ac_on = COALESCE(?, ac_on)
               -- , lighting_scene = COALESCE(?, lighting_scene) -- Descomente se adicionar a coluna
             WHERE id = ?`;
  const params = [
    status,
    current_course_id,
    lighting_intensity,
    ac_temperature,
    acOnValue,
    // lighting_scene, // Descomente se adicionar
    req.params.id
  ];
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Sala não encontrada.' });
    res.json({ message: 'Status da sala atualizado com sucesso.' });
  });
});

// ----------------------------------------------------------------
// --- Tabela: Schedules (Horários)
// ----------------------------------------------------------------
app.post('/api/schedules', (req, res) => {
  const { course_id, room_id, day_of_week, start_time, end_time } = req.body;
  const sql = "INSERT INTO Schedules (course_id, room_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)";
  db.run(sql, [course_id, room_id, day_of_week, start_time, end_time], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.get('/api/schedules', (req, res) => {
  // JOIN para trazer nomes do curso e sala
  const sql = `
    SELECT 
      s.id, s.day_of_week, s.start_time, s.end_time,
      c.name as course_name, r.name as room_name, c.professor_id
    FROM Schedules s
    JOIN Courses c ON s.course_id = c.id
    JOIN Rooms r ON s.room_id = r.id
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/schedules/:id', (req, res) => {
  db.run("DELETE FROM Schedules WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Horário não encontrado.' });
    res.json({ message: 'Horário deletado com sucesso.' });
  });
});

// ----------------------------------------------------------------
// --- Tabela: Enrollments (Matrículas)
// ----------------------------------------------------------------
app.post('/api/enrollments', (req, res) => {
  const { student_id, course_id } = req.body;
  db.run("INSERT INTO Enrollments (student_id, course_id) VALUES (?, ?)", [student_id, course_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// Pega todos os cursos de UM aluno
app.get('/api/enrollments/student/:id', (req, res) => {
  const sql = `
    SELECT c.name as course_name, e.grade
    FROM Enrollments e
    JOIN Courses c ON e.course_id = c.id
    WHERE e.student_id = ?
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Pega todos os alunos de UM curso
app.get('/api/enrollments/course/:id', (req, res) => {
  const sql = `
    SELECT u.id as student_id, u.name as student_name, e.grade
    FROM Enrollments e
    JOIN Users u ON e.student_id = u.id
    WHERE e.course_id = ? AND u.role = 'Aluno'
    ORDER BY u.name
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------------------------------------------------------------
// --- Tabela: AttendanceRecords (Presença)
// ----------------------------------------------------------------
app.post('/api/attendance', (req, res) => {
  // Esta rota será chamada pelo seu leitor RFID
  const { student_id, schedule_id, status } = req.body;
  const scan_timestamp = new Date().toISOString(); // Pega data e hora atual

  const sql = "INSERT INTO AttendanceRecords (student_id, schedule_id, scan_timestamp, status) VALUES (?, ?, ?, ?)";
  db.run(sql, [student_id, schedule_id, scan_timestamp, status], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, timestamp: scan_timestamp });
  });
});

// Pega a lista de presença de uma aula (schedule)
app.get('/api/attendance/schedule/:id', (req, res) => {
  const sql = `
    SELECT u.name as student_name, a.scan_timestamp, a.status
    FROM AttendanceRecords a
    JOIN Users u ON a.student_id = u.id
    WHERE a.schedule_id = ?
    ORDER BY u.name
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// --- ROTA NOVA ADICIONADA ---
/**
 * Rota para salvar a presença MANUALMENTE (em massa) vinda do dashboard do professor
 */
app.post('/api/attendance/manual-bulk', (req, res) => {
  const { schedule_id, attendance_list } = req.body;

  if (!schedule_id || !Array.isArray(attendance_list)) {
    return res.status(400).json({ error: 'Dados de requisição inválidos. Esperado "schedule_id" e "attendance_list".' });
  }

  const scan_timestamp = new Date().toISOString();

  // Usamos 'INSERT OR REPLACE' para atualizar a presença se ela já foi marcada (ex: pelo RFID)
  // ou inserir uma nova se não foi.
  // Isso requer que a combinação (student_id, schedule_id) seja uma CHAVE ÚNICA (UNIQUE constraint)
  // na sua tabela AttendanceRecords para funcionar corretamente.
  const sql = `INSERT OR REPLACE INTO AttendanceRecords (student_id, schedule_id, scan_timestamp, status) 
               VALUES (?, ?, ?, ?)`;

  // Usamos db.serialize para garantir que as queries rodem em ordem
  db.serialize(() => {
    const stmt = db.prepare(sql);
    let errors = [];

    attendance_list.forEach(record => {
      // Validação básica para evitar erros
      if (record.student_id == null || record.status == null) {
        console.warn('Registro de presença ignorado (dados incompletos):', record);
        return; // Pula este registro
      }

      stmt.run(record.student_id, schedule_id, scan_timestamp, record.status, (err) => {
        if (err) {
          console.error('Erro ao inserir registro:', err.message);
          errors.push(err.message);
        }
      });
    });

    stmt.finalize((err) => {
      if (err) {
        errors.push(err.message);
      }

      if (errors.length > 0) {
        return res.status(500).json({
          error: 'Ocorreram erros ao processar alguns registros de presença.',
          details: errors
        });
      }

      res.status(201).json({ message: `Presença registrada com sucesso para ${attendance_list.length} alunos.` });
    });
  });
});
// --- FIM DA ROTA NOVA ---


// ----------------------------------------------------------------
// --- Tabela: ClassEvents (Eventos de Aula)
// ----------------------------------------------------------------
app.post('/api/events', (req, res) => {
  // Ex: Professor clica em "Iniciar Aula"
  const { schedule_id, professor_id, event_type } = req.body;
  const event_timestamp = new Date().toISOString();

  const sql = "INSERT INTO ClassEvents (schedule_id, professor_id, event_timestamp, event_type) VALUES (?, ?, ?, ?)";
  db.run(sql, [schedule_id, professor_id, event_timestamp, event_type], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.get('/api/events/schedule/:id', (req, res) => {
  db.all("SELECT * FROM ClassEvents WHERE schedule_id = ? ORDER BY event_timestamp DESC", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// ----------------------------------------------------------------
// --- Tabela: Notices (Avisos)
// ----------------------------------------------------------------
app.post('/api/notices', (req, res) => {
  const { title, content, type } = req.body;
  db.run("INSERT INTO Notices (title, content, type) VALUES (?, ?, ?)", [title, content, type], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.get('/api/notices', (req, res) => {
  db.all("SELECT * FROM Notices ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/notices/:id', (req, res) => {
  db.run("DELETE FROM Notices WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Aviso não encontrado.' });
    res.json({ message: 'Aviso deletado com sucesso.' });
  });
});


// --- 6. Iniciar o Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Testando em http://localhost:${PORT}`);
});