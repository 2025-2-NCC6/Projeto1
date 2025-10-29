PRAGMA foreign_keys = ON;

CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rfid_tag_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('Aluno', 'Professor', 'Coordenador'))
);

CREATE TABLE Courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    professor_id INTEGER NOT NULL,
    FOREIGN KEY (professor_id) REFERENCES Users (id)
);

CREATE TABLE Rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('Livre', 'Em Aula', 'Manutencao')),
    current_course_id INTEGER, -- Pode ser nulo se a sala estiver livre
    lighting_intensity INTEGER DEFAULT 0, -- Nível de 0 a 100
    ac_temperature INTEGER DEFAULT 22,
    ac_on INTEGER NOT NULL DEFAULT 0, -- SQLite não tem BOOLEAN (0 = false, 1 = true)
    FOREIGN KEY (current_course_id) REFERENCES Courses (id)
);

CREATE TABLE Schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL, -- Ex: "Segunda-feira"
    start_time TEXT NOT NULL,  -- Formato "HH:MM"
    end_time TEXT NOT NULL,    -- Formato "HH:MM"
    FOREIGN KEY (course_id) REFERENCES Courses (id),
    FOREIGN KEY (room_id) REFERENCES Rooms (id)
);

CREATE TABLE Enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade REAL, -- REAL é o tipo para números com decimal (float)
    FOREIGN KEY (student_id) REFERENCES Users (id),
    FOREIGN KEY (course_id) REFERENCES Courses (id)
);

CREATE TABLE AttendanceRecords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    scan_timestamp TEXT NOT NULL, -- Data e hora exata da leitura do RFID
    status TEXT NOT NULL CHECK(status IN ('Presente', 'Atrasado', 'Ausente')),
    FOREIGN KEY (student_id) REFERENCES Users (id),
    FOREIGN KEY (schedule_id) REFERENCES Schedules (id)
);

CREATE TABLE ClassEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    professor_id INTEGER NOT NULL,
    event_timestamp TEXT NOT NULL, -- Data e hora do evento
    event_type TEXT NOT NULL CHECK(event_type IN ('Aula Iniciada', 'Aula Finalizada')),
    FOREIGN KEY (schedule_id) REFERENCES Schedules (id),
    FOREIGN KEY (professor_id) REFERENCES Users (id)
);

CREATE TABLE Notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Cancelamento', 'Prazo', 'Palestra', 'Aviso Geral'))
);