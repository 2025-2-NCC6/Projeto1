
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

// LOG DE DIAGNÓSTICO: MOSTRAR O CAMINHO ABSOLUTO DO BANCO DE DADOS
console.log('--- [DIAGNÓSTICO DE BANCO DE DADOS] ---');
console.log(`O servidor está tentando ler o banco de dados em: ${dbPath}`);
console.log('-------------------------------------------');

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
app.post('/api/register', async (req, res) => {
  const { name, email, password, rfid_tag_id, role } = req.body;

  if (!name || !email || !password || !rfid_tag_id || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const sql = `INSERT INTO Users (name, email, password_hash, rfid_tag_id, role) 
                 VALUES (?, ?, ?, ?, ?)`;
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

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const sql = "SELECT * FROM Users WHERE email = ?";
  
  db.get(sql, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }

      res.json({
        message: 'Login bem-sucedido!',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
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
app.get('/api/users', (req, res) => {
  db.all("SELECT id, name, email, rfid_tag_id, role FROM Users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id', (req, res) => {
  db.get("SELECT id, name, email, rfid_tag_id, role FROM Users WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(row);
  });
});

app.put('/api/users/:id', (req, res) => {
  const { name, email, role } = req.body;
  const sql = "UPDATE Users SET name = ?, email = ?, role = ? WHERE id = ?";
  db.run(sql, [name, email, role, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ message: 'Usuário atualizado com sucesso.', changes: this.changes });
  });
});

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
  // mostrar a origem da req
  console.log(req.headers['user-agent']);
});

// ### ROTA NOVA (para Painel Admin) ###
app.get('/api/rooms/detailed', (req, res) => {
    const dia = getDiaSemanaNumero();
    const hora = getHoraAtual();

    const sql = `
        SELECT 
            r.*,
            c.name as course_name,
            u.name as professor_name,
            -- Sub-query para encontrar o schedule_id da aula que está acontecendo AGORA nesta sala
            (SELECT s.id FROM Schedules s 
             WHERE s.room_id = r.id 
             AND s.day_of_week = ? 
             AND s.start_time <= ? 
             AND s.end_time >= ?) as current_schedule_id
        FROM Rooms r
        LEFT JOIN Courses c ON r.current_course_id = c.id
        LEFT JOIN Users u ON c.professor_id = u.id
    `;
    // Passamos os parâmetros de dia e hora para a sub-query
    db.all(sql, [dia, hora, hora], (err, rows) => {
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

app.put('/api/rooms/status/:id', (req, res) => {
  const { status, current_course_id, lighting_intensity, ac_temperature, ac_on } = req.body;
  const acOnValue = ac_on === true ? 1 : (ac_on === false ? 0 : null);

  const sql = `UPDATE Rooms SET 
              status = COALESCE(?, status), 
              current_course_id = COALESCE(?, current_course_id), 
              lighting_intensity = COALESCE(?, lighting_intensity), 
              ac_temperature = COALESCE(?, ac_temperature), 
              ac_on = COALESCE(?, ac_on)
             WHERE id = ?`;
  const params = [
     status, 
     current_course_id, 
     lighting_intensity, 
     ac_temperature, 
     acOnValue, 
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
  const sql = `
    SELECT 
      s.id, s.day_of_week, s.start_time, s.end_time, s.course_id,
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

// ### ROTA NOVA (para Painel Admin) ###
app.get('/api/schedules/detailed', (req, res) => {
    const sql = `
      SELECT 
        s.id, s.day_of_week, s.start_time, s.end_time,
        c.name as course_name, 
        r.name as room_name,
        u.name as professor_name
      FROM Schedules s
      JOIN Courses c ON s.course_id = c.id
      JOIN Rooms r ON s.room_id = r.id
      JOIN Users u ON c.professor_id = u.id
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

// Rota modificada para Painel Aluno
app.get('/api/enrollments/student/:id', (req, res) => {
  const sql = `
    SELECT 
      c.name as course_name, 
      c.id as course_id,
      e.grade,
      u.name as professor_name
    FROM Enrollments e
    JOIN Courses c ON e.course_id = c.id
    JOIN Users u ON c.professor_id = u.id
    WHERE e.student_id = ?
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Rota para Painel Professor
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
  const { student_id, schedule_id, status } = req.body;
  const scan_timestamp = new Date().toISOString();
  
  const sql = "INSERT INTO AttendanceRecords (student_id, schedule_id, scan_timestamp, status) VALUES (?, ?, ?, ?)";
  db.run(sql, [student_id, schedule_id, scan_timestamp, status], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, timestamp: scan_timestamp });
  });
});

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

app.post('/api/attendance/manual-bulk', (req, res) => {
  const { schedule_id, attendance_list } = req.body;
  
  if (!schedule_id || !Array.isArray(attendance_list)) {
    return res.status(400).json({ error: 'Dados de requisição inválidos. Esperado "schedule_id" e "attendance_list".' });
  }

  const scan_timestamp = new Date().toISOString();
  
  const sql = `INSERT OR REPLACE INTO AttendanceRecords (student_id, schedule_id, scan_timestamp, status) 
               VALUES (?, ?, ?, ?)`;

  db.serialize(() => {
    const stmt = db.prepare(sql);
    let errors = [];

    attendance_list.forEach(record => {
      if (record.student_id == null || record.status == null) {
          console.warn('Registro de presença ignorado (dados incompletos):', record);
          return;
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

// Rota modificada para Painel Aluno
app.get('/api/attendance/student/:id', (req, res) => {
    const student_id = req.params.id;

    // Lógica de frequência MODIFICADA
    const totalSql = `
        SELECT COUNT(*) as total_classes
        FROM AttendanceRecords
        WHERE student_id = ?
    `;
    
    db.get(totalSql, [student_id], (err, totalResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const total_classes = totalResult.total_classes;
        if (total_classes === 0) {
            return res.json({ total_classes: 0, present_classes: 0, percentage: 100 });
        }

        const presentSql = `
            SELECT COUNT(*) as present_classes
            FROM AttendanceRecords
            WHERE student_id = ? 
            AND status = 'Presente'
        `;
        
        db.get(presentSql, [student_id], (err, presentResult) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const present_classes = presentResult.present_classes;
            const percentage = Math.round((present_classes / total_classes) * 100);

            res.json({
                total_classes: total_classes,
                present_classes: present_classes,
                percentage: percentage
            });
        });
    });
});


// ----------------------------------------------------------------
// --- Tabela: ClassEvents (Eventos de Aula)
// ----------------------------------------------------------------
app.post('/api/events', (req, res) => {
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

// ### ROTA NOVA (para Painel Admin) ###
app.delete('/api/notices/all', (req, res) => {
    db.run("DELETE FROM Notices", [], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Todos os avisos foram arquivados.', changes: this.changes });
    });
});

// ----------------------------------------------------------------
// --- NOVAS ROTAS DE MÉTRICAS (para Painel Admin) ---
// ----------------------------------------------------------------

app.get('/api/metrics/attendance/overall', (req, res) => {
    const totalSql = "SELECT COUNT(*) as total_records FROM AttendanceRecords";
    db.get(totalSql, [], (err, totalResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const total_records = totalResult.total_records;
        if (total_records === 0) {
            return res.json({ percentage: 100 }); // Se não há registros, a presença é 100%
        }

        const presentSql = "SELECT COUNT(*) as present_records FROM AttendanceRecords WHERE status = 'Presente'";
        db.get(presentSql, [], (err, presentResult) => {
            if (err) return res.status(500).json({ error: err.message }); // Corrigido de 5G00 para 500
            
            const present_records = presentResult.present_records;
            const percentage = Math.round((present_records / total_records) * 100);
            res.json({ percentage: percentage });
        });
    });
});

// NOVA ROTA: Verifica e finaliza aulas cujo tempo já expirou
app.post('/api/rooms/update-state', (req, res) => {
    const sql = `
        UPDATE Rooms
        SET status = 'Livre', current_course_id = NULL
        WHERE status = 'Em Aula' AND id IN (
            SELECT s.room_id FROM Schedules s
            WHERE s.course_id = Rooms.current_course_id
              AND s.day_of_week = CAST(strftime('%w', 'now', 'localtime') AS INTEGER)
              AND s.end_time < time('now', 'localtime')
        )
    `;
    db.run(sql, [], function(err) {
        if (err) {
            return res.status(500).json({ error: `Erro ao atualizar estado das salas: ${err.message}` });
        }
        if (this.changes > 0) {
            console.log(`[AUTO] ${this.changes} aula(s) finalizada(s) automaticamente.`);
        }
        // Sempre retorna sucesso, pois esta é uma tarefa de manutenção
        res.status(200).json({ message: 'Verificação de estado concluída.', changes: this.changes });
    });
});

// ROTA DE DEBUG: Para verificar a hora do banco de dados
app.get('/api/debug/time', (req, res) => {
    const sql = "SELECT time('now', 'localtime') as db_time, CAST(strftime('%w', 'now', 'localtime') AS INTEGER) as db_day";
    db.get(sql, [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "Hora atual segundo o banco de dados SQLite",
            database_time: row.db_time,
            database_day_of_week: row.db_day,
            server_nodejs_time: new Date().toLocaleTimeString('pt-BR', { hour12: false })
        });
    });
});

// --- 6. NOVAS ROTAS DE INTEGRAÇÃO RFID (ARDUINO) ---

/**
 * Converte o dia da semana (número) para o texto usado no DB
 */
function getDiaSemanaNumero() {
  return new Date().getDay();
}

/**
 * Pega a hora atual no formato "HH:MM"
 */
function getHoraAtual() {
  const data = new Date();
  const h = data.getHours().toString().padStart(2, '0');
  const m = data.getMinutes().toString().padStart(2, '0');
  const s = data.getSeconds().toString().padStart(2, '0'); // <-- ADICIONADO
  return `${h}:${m}:${s}`; // <-- FORMATO ALTERADO
}


// ROTA 1: Professor inicia a aula
// Em server.js, dentro da rota app.post('/api/rfid/iniciar-aula', ...)

app.post('/api/rfid/iniciar-aula', (req, res) => {
    const { rfid_tag_id } = req.body;
    if (!rfid_tag_id) return res.status(400).json({ error: 'rfid_tag_id é obrigatório.' });

    const sqlProf = "SELECT * FROM Users WHERE rfid_tag_id = ? AND role = 'Professor'";
    db.get(sqlProf, [rfid_tag_id], (err, prof) => {
        if (err || !prof) return res.status(404).json({ error: 'Professor não encontrado para esta tag.' });

        const dia = getDiaSemanaNumero();

        const sqlSchedule = `
            SELECT s.* FROM Schedules s
            JOIN Courses c ON s.course_id = c.id
            WHERE c.professor_id = ? AND s.day_of_week = ?
            ORDER BY s.start_time`;
        
        // --- ALTERAÇÃO PRINCIPAL AQUI ---
        // Vamos forçar a conversão para Número para garantir que o driver não se confunda.
        const params = [Number(prof.id), Number(dia)];

        // LOG FINAL: Vamos ver exatamente o que está sendo executado.
        console.log(`[LOG FINAL] Executando query: \n${sqlSchedule.replace(/\s\s+/g, ' ')}\nCom parâmetros:`, params);

        db.all(sqlSchedule, params, (err, aulasDoDia) => {
            if (err) return res.status(500).json({ error: `Erro ao buscar agenda: ${err.message}` });
            
            // Log para ver o que o banco retornou
            console.log('[LOG FINAL] Resultado da query (aulasDoDia):', aulasDoDia);

            if (!aulasDoDia || aulasDoDia.length === 0) {
                return res.status(404).json({ error: `Nenhuma aula agendada para ${prof.name} hoje.` });
            }

            // O resto da lógica para encontrar a aula atual e iniciar continua a mesma...
            const agora = new Date();
            const schedule = aulasDoDia.find(aula => {
                const inicio = new Date();
                const [startH, startM, startS] = aula.start_time.split(':');
                inicio.setHours(startH, startM, startS);

                const fim = new Date();
                const [endH, endM, endS] = aula.end_time.split(':');
                fim.setHours(endH, endM, endS);

                return agora >= inicio && agora <= fim;
            });

            if (!schedule) {
                const horaDebug = agora.toLocaleTimeString('pt-BR', { hour12: false });
                return res.status(404).json({ error: `Nenhuma aula agendada para ${prof.name} neste exato momento (${horaDebug}).` });
            }

            const sqlUpdateRoom = "UPDATE Rooms SET status = 'Em Aula', current_course_id = ? WHERE id = ?";
            db.run(sqlUpdateRoom, [schedule.course_id, schedule.room_id], function(err) {
                if (err) return res.status(500).json({ error: `Erro ao atualizar sala: ${err.message}` });
                console.log(`[RFID] Aula iniciada pelo Prof. ${prof.name} na Sala ID ${schedule.room_id}`);
                res.status(200).json({
                    message: 'Aula iniciada com sucesso!',
                    schedule: schedule
                });
            });
        });
    });
});

// ROTA 2: Aluno registra presença
app.post('/api/rfid/marcar-presenca', (req, res) => {
  const { rfid_tag_id, room_id } = req.body;
  

  if (!rfid_tag_id || room_id == null) {
    return res.status(400).json({ error: 'rfid_tag_id e room_id são obrigatórios.' });
  }

  // 1. Encontra o aluno pela tag
  const sqlStudent = "SELECT * FROM Users WHERE rfid_tag_id = ? AND role = 'Aluno'";
  db.get(sqlStudent, [rfid_tag_id], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado para esta tag.' });

    // 2. Encontra a aula ativa NAQUELA SALA
    const dia = getDiaSemanaNumero();
    // A query agora usa a função time() do próprio SQLite.
    const sqlSchedule = `
      SELECT id FROM Schedules 
      WHERE room_id = ? 
      AND day_of_week = ? 
      AND start_time <= time('now', 'localtime') 
      AND end_time >= time('now', 'localtime')`;

    // Note que agora passamos apenas o room_id e o dia.
    db.get(sqlSchedule, [room_id, dia], (err, schedule) => {
      if (err) return res.status(500).json({ error: `Erro ao buscar agenda: ${err.message}` });
      if (!schedule) return res.status(404).json({ error: 'Nenhuma aula ativa encontrada nesta sala agora.' });

      // 3. Insere (ou atualiza) o registro de presença
      // Usamos "INSERT OR REPLACE" para o caso do aluno passar a tag 2x
      const sqlInsert = `
        INSERT OR REPLACE INTO AttendanceRecords 
        (student_id, schedule_id, scan_timestamp, status) 
        VALUES (?, ?, ?, ?)`;
      
      const timestamp = new Date().toISOString();
      db.run(sqlInsert, [student.id, schedule.id, timestamp, 'Presente'], function(err) {
        if (err) return res.status(500).json({ error: `Erro ao inserir presença: ${err.message}` });
        
        console.log(`[RFID] Presença registrada: ${student.name} na Aula ID ${schedule.id}`);
        res.status(201).json({
          message: 'Presença registrada!',
          aluno: student.name
        });
      });
    });
  });
});


// --- 7. Iniciar o Servidor ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Testando em http://localhost:${PORT}`);
  console.log(`Acessível na sua rede local em http://192.168.0.172:${PORT}`); //! colocar o ip da sua maquina aqui
});