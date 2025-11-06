// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';
// !!!!!!!!!!!!!!!!!! ATENÇÃO !!!!!!!!!!!!!!!!!!
// MUDE ESTE ID para o ID do aluno que você quer ver
// (Ex: 2, 4, 7, 8, etc., da sua lista de usuários)
const CURRENT_STUDENT_ID = 8; 
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// --- DOM ONLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadPageData();
});

/**
 * Função principal que carrega todos os dados da página
 */
async function loadPageData() {
    // Carrega em paralelo para mais performance
    Promise.all([
        loadStudentInfo(CURRENT_STUDENT_ID),
        loadMyCourses(CURRENT_STUDENT_ID),
        loadNotices(),
        loadGeneralAttendance(CURRENT_STUDENT_ID)
    ]).then(([student, courses, notices, attendance]) => {
        // Depois que as disciplinas e horários carregarem,
        // podemos descobrir a próxima aula
        findNextClass(courses);
    }).catch(error => {
        console.error('Erro ao carregar dados da página:', error);
    });
}

/**
 * Carrega o nome do aluno no header
 */
async function loadStudentInfo(studentId) {
    try {
        const response = await fetch(`${API_URL}/users/${studentId}`);
        if (!response.ok) throw new Error('Aluno não encontrado');
        
        const student = await response.json();
        document.getElementById('student-name').textContent = student.name;
        
        // Atualiza o avatar
        const avatar = document.getElementById('user-avatar');
        const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        avatar.src = `https://placehold.co/32x32/1193d4/FFFFFF?text=${initials}`;

        return student; // Retorna os dados do aluno

    } catch (error) {
        console.error('Erro - loadStudentInfo:', error);
        document.getElementById('student-name').textContent = 'Erro ao carregar';
    }
}

/**
 * Carrega a lista de disciplinas em que o aluno está matriculado
 */
async function loadMyCourses(studentId) {
    try {
        const response = await fetch(`${API_URL}/enrollments/student/${studentId}`);
        if (!response.ok) throw new Error('Erro ao buscar disciplinas');

        const courses = await response.json();
        const container = document.getElementById('disciplinas-container');
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (courses.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Você não está matriculado em nenhuma disciplina.</p>';
            return [];
        }

        courses.forEach(course => {
            // Ícone aleatório simples (pode ser melhorado)
            const icons = ['calculate', 'code', 'psychology', 'biotech', 'gavel', 'history_edu', 'book', 'computer'];
            const randomIcon = icons[Math.floor(Math.random() * icons.length)];

            const courseHtml = `
            <div class="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow hover:shadow-lg transition-shadow cursor-pointer">
              <div class="flex items-center space-x-4">
                <div class="flex-shrink-0 bg-primary/20 text-primary p-3 rounded-lg">
                  <span class="material-icons">${randomIcon}</span>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-800 dark:text-white">${course.course_name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Prof. ${course.professor_name || 'N/D'}</p>
                </div>
              </div>
            </div>
            `;
            container.innerHTML += courseHtml;
        });

        return courses; // Retorna as disciplinas para a próxima função

    } catch (error) {
        console.error('Erro - loadMyCourses:', error);
    }
}

/**
 * Carrega a lista de avisos
 */
async function loadNotices() {
    try {
        const response = await fetch(`${API_URL}/notices`);
        if (!response.ok) throw new Error('Erro ao buscar avisos');
        
        const notices = await response.json();
        const container = document.getElementById('avisos-container');
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (notices.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Sem avisos no momento.</p>';
            return;
        }

        // Mapeia tipos de aviso para ícones e cores
        const noticeMeta = {
            'Cancelamento': { icon: 'warning', color: 'text-orange-500' },
            'Prazo': { icon: 'info', color: 'text-primary' },
            'Palestra': { icon: 'campaign', color: 'text-primary' },
            'Aviso Geral': { icon: 'info', color: 'text-gray-500' }
        };

        notices.slice(0, 3).forEach(notice => { // Mostra apenas os 3 primeiros
            const meta = noticeMeta[notice.type] || noticeMeta['Aviso Geral'];
            const noticeHtml = `
            <li class="flex items-start">
              <div class="flex-shrink-0">
                <span class="material-icons ${meta.color} mt-0.5">${meta.icon}</span>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100">${notice.title}</p>
                <p class="text-sm text-gray-600 dark:text-gray-300">${notice.content}</p>
              </div>
            </li>
            `;
            container.innerHTML += noticeHtml;
        });

        return notices; // Retorna os avisos

    } catch (error) {
        console.error('Erro - loadNotices:', error);
    }
}

/**
 * Carrega a frequência geral do aluno
 */
async function loadGeneralAttendance(studentId) {
    try {
        const response = await fetch(`${API_URL}/attendance/student/${studentId}`);
        if (!response.ok) throw new Error('Erro ao buscar frequência');

        const data = await response.json();
        
        const percent = data.percentage;
        const textEl = document.getElementById('frequencia-texto');
        const circleEl = document.getElementById('frequencia-circulo');

        textEl.textContent = `${percent}%`;

        // Lógica do anel de progresso
        const radius = circleEl.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percent / 100) * circumference;
        
        circleEl.style.strokeDasharray = `${circumference} ${circumference}`;
        circleEl.style.strokeDashoffset = offset;

        // Muda a cor com base na %
        if (percent < 75) {
            textEl.classList.remove('text-green-500');
            circleEl.classList.remove('text-green-500');
            textEl.classList.add('text-orange-500');
            circleEl.classList.add('text-orange-500');
        }

        return data;

    } catch (error) {
        console.error('Erro - loadGeneralAttendance:', error);
        document.getElementById('frequencia-texto').textContent = 'N/A';
    }
}


/**
 * Encontra a próxima aula com base nas disciplinas do aluno
 */
async function findNextClass(studentCourses) {
    if (!studentCourses || studentCourses.length === 0) {
        document.getElementById('proxima-aula-nome').textContent = 'Sem aulas cadastradas';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/schedules`);
        const allSchedules = await response.json();

        // Filtra todos os horários para incluir apenas os cursos do aluno
        const studentCourseIds = studentCourses.map(c => c.course_id);
        const mySchedules = allSchedules.filter(s => studentCourseIds.includes(s.course_id));

        if (mySchedules.length === 0) {
            document.getElementById('proxima-aula-nome').textContent = 'Sem horários cadastrados';
            return;
        }
        
        // Lógica para encontrar a "próxima" aula (simplificado)
        // TODO: Esta lógica deve ser melhorada para comparar dias da semana e horas
        // Por enquanto, apenas pegamos a primeira aula da lista de horários do aluno.
        const nextClass = mySchedules[0];

        // Popula o card "Próxima Aula"
        document.getElementById('proxima-aula-nome').textContent = nextClass.course_name;
        document.getElementById('proxima-aula-horario').textContent = `${nextClass.day_of_week}, ${nextClass.start_time} - ${nextClass.end_time}`;
        document.getElementById('proxima-aula-sala').textContent = nextClass.room_name;
        
        // Encontra o nome do professor (assumindo que já foi carregado em 'studentCourses')
        const courseInfo = studentCourses.find(c => c.course_id === nextClass.course_id);
        if (courseInfo) {
            document.getElementById('proxima-aula-prof').textContent = `Prof. ${courseInfo.professor_name}`;
        }

    } catch (error) {
        console.error('Erro - findNextClass:', error);
    }
}