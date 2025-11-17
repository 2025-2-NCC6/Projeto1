-- 1. Cria o curso de Engenharia de Software para o Professor Rodnil Rods (ID 6)
INSERT INTO Courses (name, professor_id) VALUES ('Engenharia de Software', 6);

-- 2. Matricula 4 alunos no curso de Engenharia de Software (ID 1)
-- (Usando os IDs dos alunos definidos no Arduino)
INSERT INTO Enrollments (student_id, course_id) VALUES (2, 9); -- Ana S. Silva
INSERT INTO Enrollments (student_id, course_id) VALUES (3, 9); -- Lara
INSERT INTO Enrollments (student_id, course_id) VALUES (4, 9); -- Vitor Locateli
INSERT INTO Enrollments (student_id, course_id) VALUES (7, 9); -- Beatriz Costa

-- 3. Agenda a aula para hoje (ex: Segunda-feira), das 19:00 às 21:00, na Sala 1
-- IMPORTANTE: Mude 'Segunda-feira' para o dia da semana atual em que você está testando
INSERT INTO Schedules (course_id, room_id, day_of_week, start_time, end_time) VALUES (9, 1, 'Segunda-feira', '15:00:00', '19:00:00');

UPDATE Rooms SET status = 'Livre', current_course_id = NULL WHERE id = 1;

UPDATE Schedules SET day_of_week = 1 WHERE day_of_week = 'Segunda-feira';
UPDATE Schedules SET day_of_week = 2 WHERE day_of_week = 'Terça-feira';
UPDATE Schedules SET day_of_week = 3 WHERE day_of_week = 'Quarta-feira';
UPDATE Schedules SET day_of_week = 4 WHERE day_of_week = 'Quinta-feira';
UPDATE Schedules SET day_of_week = 5 WHERE day_of_week = 'Sexta-feira';
UPDATE Schedules SET day_of_week = 6 WHERE day_of_week = 'Sábado';
UPDATE Schedules SET day_of_week = 0 WHERE day_of_week = 'Domingo';

--- 1.1
SELECT * FROM Schedules WHERE course_id = 9 AND room_id = 1;

--- 1.2 
SELECT * FROM Rooms WHERE id = 1;

--- 1.3
SELECT * FROM Courses WHERE id = 9;

SELECT
    s.id as schedule_id,
    s.course_id,
    s.day_of_week,
    c.id as course_table_id,
    c.name as course_name,
    c.professor_id
FROM Schedules s
JOIN Courses c ON s.course_id = c.id
WHERE c.professor_id = 6 AND s.day_of_week = 1;