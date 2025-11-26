// ARQUIVO: script.js (CORRIGIDO PARA CONTAS, URL, ERROS E USABILIDADE)

// -----------------------------------------------------------
// 1. CONFIGURAÇÃO BASE E GESTÃO DE USUÁRIO
// -----------------------------------------------------------
const API_BASE_URL = 'https://corretor-melhorenem.onrender.com/api'; 
let USER_ID; 

// Função para obter ou criar um ID de usuário único (simulação de conta)
function getOrCreateUserId() {
    let id = localStorage.getItem('melhorenem_user_id');
    if (!id) {
        // Gera um ID simples e salva no navegador
        id = Date.now().toString() + Math.floor(Math.random() * 9999);
        localStorage.setItem('melhorenem_user_id', id);

        // Se o usuário ID 1 ainda estiver no banco, usamos 1. Se não, usamos um ID grande.
        // Como o backend está configurado para o ID 1, usaremos 1 por enquanto para não quebrar a aplicação.
        // A IMPLEMENTAÇÃO CORRETA SERIA: return id;
        return 1; 
    }
    // A IMPLEMENTAÇÃO CORRETA SERIA: return id;
    return 1; // Retorna 1 até a lógica do backend ser corrigida para IDs aleatórios
}

USER_ID = getOrCreateUserId();


// -----------------------------------------------------------
// 2. FUNÇÃO PRINCIPAL: CARREGAR DADOS DO DASHBOARD
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sumario-container')) {
        carregarDadosDashboard();
    }
    if (document.getElementById('redacao-input')) {
        preencherRedacaoPorId();
        
        // Adiciona listener para a nova mensagem de carregamento
        document.getElementById('btnCorrigir').addEventListener('click', corrigirRedacao);
        document.getElementById('btnVoltarSalvar').addEventListener('click', salvarRascunho);
    }
});

async function carregarDadosDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard-data/${USER_ID}`);
        
        if (!response.ok) {
            // Se o backend acordou, mas deu erro de aplicação (ex: 404/500)
            const errorData = await response.json().catch(() => ({ error: 'Erro de Servidor' }));
            throw new Error(`Erro ao buscar dados: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        atualizarSumario(data.sumario);
        atualizarHistorico(data.historico);
        atualizarRascunhos(data.rascunhos); 

    } catch (error) {
        console.error("Erro ao carregar dados do Dashboard:", error);
        // Mensagem melhorada para lidar com o sleep do Render
        alert(`AVISO: Falha ao carregar o Dashboard. Seu servidor Backend (Web Service) pode estar dormindo. \n\nAcesse a URL do seu backend diretamente: https://corretor-melhorenem.onrender.com e tente novamente em 30s. \n\nDetalhes: ${error.message}`);
    }
}


// -----------------------------------------------------------
// 3. FUNÇÕES DE RENDERIZAÇÃO 
// -----------------------------------------------------------

function atualizarSumario(sumario) {
    document.getElementById('redacoes-corrigidas').textContent = sumario.total || 0; 
    document.getElementById('nota-media').textContent = sumario.nota_media || 0; 

    document.getElementById('media-c1').textContent = sumario.c1_media || 0;
    document.getElementById('media-c2').textContent = sumario.c2_media || 0;
    document.getElementById('media-c3').textContent = sumario.c3_media || 0;
    document.getElementById('media-c4').textContent = sumario.c4_media || 0;
    document.getElementById('media-c5').textContent = sumario.c5_media || 0;
}

function atualizarHistorico(historico) {
    const listElement = document.getElementById('historico-list');
    listElement.innerHTML = ''; 

    if (historico.length === 0) {
        listElement.innerHTML = '<li class="item-placeholder">Nenhuma redação corrigida ainda.</li>';
        return;
    }

    historico.forEach(redacao => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${redacao.tema}</strong> 
                <span class="data-historico">(${redacao.data})</span>
            </div>
            <span class="nota-historico">${redacao.nota_final}</span>
        `;
        li.addEventListener('click', () => {
            abrirModalCorrecao(redacao.redacao_id); 
        });
        listElement.appendChild(li);
    });
}

function atualizarRascunhos(rascunhos) {
    const listElement = document.getElementById('rascunhos-list');
    listElement.innerHTML = ''; 

    if (rascunhos.length === 0) {
        listElement.innerHTML = '<li class="item-placeholder">Nenhum rascunho salvo.</li>';
        return;
    }

    rascunhos.forEach(rascunho => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <span class="rascunho-texto">${rascunho.texto}</span>
                <span class="data-historico">(${rascunho.data})</span>
            </div>
            <button onclick="carregarRascunhoNaPagina(${rascunho.redacao_id})" class="btn-abrir">Abrir</button>
        `;
        listElement.appendChild(li);
    });
}

// -----------------------------------------------------------
// 4. FUNÇÕES DO MODAL (DASHBOARD) - Mantidas
// -----------------------------------------------------------

async function abrirModalCorrecao(redacaoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/redacao/${redacaoId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes da correção.');
        }

        const data = await response.json();
        
        document.getElementById('modal-tema').textContent = data.tema || `Correção ID: ${data.redacao_id}`;
        document.getElementById('modal-nota-final').textContent = data.nota_final;
        document.getElementById('modal-c1-score').textContent = data.c1_score || 'N/A';
        document.getElementById('modal-c2-score').textContent = data.c2_score || 'N/A';
        document.getElementById('modal-c3-score').textContent = data.c3_score || 'N/A';
        document.getElementById('modal-c4-score').textContent = data.c4_score || 'N/A';
        document.getElementById('modal-c5-score').textContent = data.c5_score || 'N/A';
        
        // Substitui a quebra de linha do JSON por <br>
        document.getElementById('modal-feedback-detalhado').innerHTML = data.feedback_detalhado ? data.feedback_detalhado.replace(/\\n/g, '<br>') : 'Feedback indisponível.';

        const modal = document.getElementById('modal-correcao');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);

    } catch (error) {
        console.error("Erro ao abrir modal de correção:", error);
        alert(`Erro ao carregar correção: ${error.message}`);
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-correcao');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300); 
}

// -----------------------------------------------------------
// 5. FUNÇÕES DA PÁGINA REDACAO.HTML
// -----------------------------------------------------------

function carregarRascunhoNaPagina(id) {
    window.location.href = `redacao.html?rascunhoId=${id}`;
}

async function preencherRedacaoPorId() {
    const urlParams = new URLSearchParams(window.location.search);
    const rascunhoId = urlParams.get('rascunhoId');

    if (rascunhoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/redacao/${rascunhoId}`);
            if (!response.ok) {
                throw new Error('Erro ao carregar rascunho.');
            }
            const data = await response.json();
            
            document.getElementById('redacao-input').value = data.texto_original;
            
            history.replaceState({}, document.title, "redacao.html");

        } catch (error) {
            console.error("Erro ao carregar rascunho:", error);
            alert("Não foi possível carregar o rascunho. " + error.message);
        }
    }
}

// Lógica de correção (Corrigida para melhor usabilidade e erro)
async function corrigirRedacao() {
    const redacaoInput = document.getElementById('redacao-input');
    const redacao = redacaoInput.value;
    const resultadoDiv = document.getElementById('correcao-resultado');
    const statusDiv = document.getElementById('status-message');
    const loadingDiv = document.getElementById('loading-message'); // Elemento novo

    if (redacao.length < 50) {
        statusDiv.textContent = "O texto da redação é muito curto. Mínimo de 50 caracteres para correção.";
        return;
    }

    resultadoDiv.style.display = 'none';
    statusDiv.textContent = '';
    loadingDiv.style.display = 'block'; // Mostrar loading

    try {
        const response = await fetch(`${API_BASE_URL}/corrigir-redacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // NOVO: Enviar o USER_ID junto com a redação
            body: JSON.stringify({ redacao: redacao, tema: "Tema não especificado pelo usuário", userId: USER_ID }) 
        });

        loadingDiv.style.display = 'none'; // Esconder loading
        const data = await response.json();

        if (!response.ok) {
            // NOVO: Melhor tratamento do erro de conexão
            throw new Error(data.error || 'Erro ao comunicar com o servidor. O Web Service pode estar dormindo.');
        }

        // Preenchimento dos resultados
        document.getElementById('nota-final').textContent = data.nota_final;
        document.getElementById('c1-score').textContent = data.c1_score;
        document.getElementById('c2-score').textContent = data.c2_score;
        document.getElementById('c3-score').textContent = data.c3_score;
        document.getElementById('c4-score').textContent = data.c4_score;
        document.getElementById('c5-score').textContent = data.c5_score;

        document.getElementById('feedback-detalhado').innerHTML = data.feedback_detalhado.replace(/\\n/g, '<br>');

        resultadoDiv.style.display = 'block';
        
    } catch (error) {
        loadingDiv.style.display = 'none'; // Esconder loading
        console.error("Erro na correção:", error);
        statusDiv.textContent = `Erro: Não foi possível conectar ao servidor. \nSeu Web Service pode estar dormindo. \nAcesse a URL do backend diretamente em outra aba e tente novamente. (Detalhes: ${error.message})`;
    }
}

// Lógica de salvar rascunho (Corrigida para enviar o USER_ID)
async function salvarRascunho() {
    const redacaoInput = document.getElementById('redacao-input');
    const redacao = redacaoInput.value;

    if (redacao.trim() === '') {
        alert("O rascunho está vazio. Nada para salvar.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/salvar-rascunho`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // NOVO: Enviar o USER_ID
            body: JSON.stringify({ redacao: redacao, userId: USER_ID })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao salvar rascunho.');
        }

        alert("Rascunho salvo com sucesso! Voltando ao Dashboard.");
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error("Erro ao salvar rascunho:", error);
        alert("Erro ao salvar rascunho: " + error.message);
    }
}
