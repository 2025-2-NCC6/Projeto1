// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';

// --- VARIÁVEL GLOBAL PARA GUARDAR O ID DO ALUNO LOGADO ---
let CURRENT_STUDENT_ID = null;

// --- DOM ONLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. TENTA RECUPERAR O USUÁRIO LOGADO DO LOCALSTORAGE
    const userJson = localStorage.getItem('user');

    // 2. SE NÃO TIVER NINGUÉM LOGADO, MANDA DE VOLTA PRO LOGIN
    if (!userJson) {
        alert('Você precisa fazer login para acessar esta página.');
        window.location.href = '../index.html'; // Ajuste o caminho se necessário
        return;
    }

    // 3. CONVERTE O JSON PARA OBJETO E PEGA O ID
    const user = JSON.parse(userJson);
    
    // (Opcional) Verifica se é realmente um ALUNO
    if (user.role !== 'Aluno') {
        alert('Acesso negado: Área exclusiva para alunos.');
        window.location.href = '../index.html';
        return;
    }

    // 4. ATUALIZA A VARIÁVEL GLOBAL COM O ID REAL
    CURRENT_STUDENT_ID = user.id;

    console.log('Iniciando dashboard para o Aluno ID:', CURRENT_STUDENT_ID);

    // 5. CARREGA OS DADOS DA PÁGINA USANDO O ID CORRETO
    loadPageData();
});

/**
 * Função principal que carrega todos os dados da página
 */
async function loadPageData() {
    // Se por algum motivo o ID ainda for nulo, para tudo.
    if (!CURRENT_STUDENT_ID) return;

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
        // Como já temos os dados no localStorage, poderíamos usar direto de lá.
        // Mas vamos buscar da API para garantir que está tudo atualizado.
        const response = await fetch(`${API_URL}/users/${studentId}`);
        if (!response.ok) throw new Error('Aluno não encontrado');
        
        const student = await response.json();
        // Garante que o elemento existe antes de tentar mudar o texto
        const nameElement = document.getElementById('student-name');
        if (nameElement) nameElement.textContent = student.name;
        
        // Atualiza o avatar
        const avatar = document.getElementById('user-avatar');
        if (avatar && student.name) {
            const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatar.src = `https://placehold.co/32x32/1193d4/FFFFFF?text=${initials}`;
        }

        return student; // Retorna os dados do aluno

    } catch (error) {
        console.error('Erro - loadStudentInfo:', error);
        const nameElement = document.getElementById('student-name');
        if (nameElement) nameElement.textContent = 'Erro ao carregar';
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
        if (!container) return []; // Proteção se o elemento não existir
        
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (courses.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full text-center py-4">Você não está matriculado em nenhuma disciplina.</p>';
            return [];
        }

        courses.forEach(course => {
            // Ícone aleatório simples
            const icons = ['calculate', 'code', 'psychology', 'biotech', 'gavel', 'history_edu', 'book', 'computer'];
            const randomIcon = icons[Math.floor(Math.random() * icons.length)];

            const courseHtml = `
            <div class="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow hover:shadow-lg transition-shadow cursor-pointer">
              <div class="flex items-center space-x-4">
                <div class="flex-shrink-0 bg-primary/20 text-primary p-3 rounded-lg">
                  <span class="material-icons">${randomIcon}</span>
                </div>
                <div class="overflow-hidden"> <h3 class="font-semibold text-gray-800 dark:text-white truncate" title="${course.course_name}">${course.course_name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 truncate">Prof. ${course.professor_name || 'N/D'}</p>
                </div>
              </div>
            </div>
            `;
            container.innerHTML += courseHtml;
        });

        return courses;

    } catch (error) {
        console.error('Erro - loadMyCourses:', error);
        const container = document.getElementById('disciplinas-container');
        if (container) container.innerHTML = '<p class="text-red-500">Erro ao carregar disciplinas.</p>';
        return [];
    }
}

/**
 * Carrega a lista de avisos (não depende do ID do aluno, então ok)
 */
async function loadNotices() {
    try {
        const response = await fetch(`${API_URL}/notices`);
        if (!response.ok) throw new Error('Erro ao buscar avisos');
        
        const notices = await response.json();
        const container = document.getElementById('avisos-container');
        if (!container) return;

        container.innerHTML = '';

        if (notices.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Sem avisos no momento.</p>';
            return;
        }

        const noticeMeta = {
            'Cancelamento': { icon: 'warning', color: 'text-orange-500' },
            'Prazo': { icon: 'info', color: 'text-primary' },
            'Palestra': { icon: 'campaign', color: 'text-primary' },
            'Aviso Geral': { icon: 'info', color: 'text-gray-500' }
        };

        notices.slice(0, 3).forEach(notice => {
            const meta = noticeMeta[notice.type] || noticeMeta['Aviso Geral'];
            const noticeHtml = `
            <li class="flex items-start space-x-3">
              <div class="flex-shrink-0">
                <span class="material-icons ${meta.color} mt-0.5">${meta.icon}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${notice.title}</p>
                <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">${notice.content}</p>
              </div>
            </li>
            `;
            container.innerHTML += noticeHtml;
        });

        return notices;

    } catch (error) {
        console.error('Erro - loadNotices:', error);
        const container = document.getElementById('avisos-container');
        if (container) container.innerHTML = '<p class="text-red-500">Erro ao carregar avisos.</p>';
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
        
        // Garante que percentage é um número e não é NaN
        const percent = Number(data.percentage) || 0;
        const textEl = document.getElementById('frequencia-texto');
        const circleEl = document.getElementById('frequencia-circulo');

        if (textEl) textEl.textContent = `${percent.toFixed(0)}%`; // Arredonda para não quebrar o layout

        if (circleEl) {
            const radius = circleEl.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            const offset = circumference - (percent / 100) * circumference;
            
            circleEl.style.strokeDasharray = `${circumference} ${circumference}`;
            circleEl.style.strokeDashoffset = offset;

            // Reseta as classes antes de aplicar
            textEl.classList.remove('text-green-500', 'text-orange-500', 'text-red-500');
            circleEl.classList.remove('text-green-500', 'text-orange-500', 'text-red-500');

            if (percent >= 75) {
                textEl.classList.add('text-green-500');
                circleEl.classList.add('text-green-500');
            } else if (percent >= 50) {
                textEl.classList.add('text-orange-500');
                circleEl.classList.add('text-orange-500');
            } else {
                textEl.classList.add('text-red-500');
                circleEl.classList.add('text-red-500');
            }
        }

        return data;

    } catch (error) {
        console.error('Erro - loadGeneralAttendance:', error);
        const textEl = document.getElementById('frequencia-texto');
        if (textEl) textEl.textContent = '--';
    }
}

/**
 * Encontra a próxima aula
 */
async function findNextClass(studentCourses) {
    const nomeEl = document.getElementById('proxima-aula-nome');
    const horarioEl = document.getElementById('proxima-aula-horario');
    const salaEl = document.getElementById('proxima-aula-sala');
    const profEl = document.getElementById('proxima-aula-prof');

    if (!studentCourses || studentCourses.length === 0) {
        if (nomeEl) nomeEl.textContent = 'Sem aulas';
        if (horarioEl) horarioEl.textContent = '---';
        if (salaEl) salaEl.textContent = '---';
        if (profEl) profEl.textContent = '';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/schedules`);
        if (!response.ok) throw new Error('Erro ao buscar horários');
        const allSchedules = await response.json();

        const studentCourseIds = studentCourses.map(c => c.course_id);
        // Filtra apenas horários das disciplinas que o aluno cursa
        const mySchedules = allSchedules.filter(s => studentCourseIds.includes(s.course_id));

        if (mySchedules.length === 0) {
            if (nomeEl) nomeEl.textContent = 'Sem horários';
            if (horarioEl) horarioEl.textContent = '---';
            return;
        }
        
        // --- LÓGICA MELHORADA PARA "PRÓXIMA AULA" ---
        // (Ainda simples, mas melhor que pegar só a primeira)
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const hoje = new Date().getDay(); // 0 (Dom) a 6 (Sáb)
        const agoraHora = new Date().getHours() * 60 + new Date().getMinutes(); // Hora atual em minutos

        // Tenta achar uma aula hoje que ainda não começou
        let nextClass = mySchedules.find(s => {
            const diaAula = diasSemana.indexOf(s.day_of_week);
            if (diaAula !== hoje) return false;
            
            const [h, m] = s.start_time.split(':').map(Number);
            const inicioAulaMinutos = h * 60 + m;
            return inicioAulaMinutos > agoraHora;
        });

        // Se não tiver aula hoje mais tarde, pega a primeira aula da semana que vem (ou amanhã)
        if (!nextClass) {
             // Ordena por dia da semana para pegar a "mais próxima"
             mySchedules.sort((a, b) => {
                const diaA = diasSemana.indexOf(a.day_of_week);
                const diaB = diasSemana.indexOf(b.day_of_week);
                return diaA - diaB; // Ordena de Domingo a Sábado
             });
             // Pega a primeira disponível na semana (simplificação)
             nextClass = mySchedules[0];
        }
        // --------------------------------------------

        if (nomeEl) nomeEl.textContent = nextClass.course_name;
        // Formata o horário para ficar mais bonito (tira os segundos se tiver)
        const start = nextClass.start_time.substring(0, 5);
        const end = nextClass.end_time.substring(0, 5);
        if (horarioEl) horarioEl.textContent = `${nextClass.day_of_week}, ${start} - ${end}`;
        if (salaEl) salaEl.textContent = nextClass.room_name;
        
        const courseInfo = studentCourses.find(c => c.course_id === nextClass.course_id);
        if (courseInfo && profEl) {
            profEl.textContent = `Prof. ${courseInfo.professor_name}`;
        }

    } catch (error) {
        console.error('Erro - findNextClass:', error);
        if (nomeEl) nomeEl.textContent = 'Erro ao buscar';
    }
}