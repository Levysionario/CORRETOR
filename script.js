// ARQUIVO: script.js (COMPLETO E CORRIGIDO PARA PRIVACIDADE)

// -----------------------------------------------------------
// 1. CONFIGURAÇÃO BASE E GESTÃO DE USUÁRIO (Simulação de Contas Únicas)
// -----------------------------------------------------------
// CORREÇÃO 1: Mudar a URL base de localhost para a URL do Render (Produção)
const API_BASE_URL = 'https://corretor-melhorenem.onrender.com/api'; 
let USER_ID; 

// CORREÇÃO 2: Função para obter ou criar um ID de usuário único e real
function getOrCreateUniqueUserId() {
    let id = localStorage.getItem('melhorenem_unique_user_id');
    if (!id) {
        // Gera um ID grande e salva no navegador para identificação
        id = 'GUEST_' + Date.now().toString() + Math.floor(Math.random() * 99999);
        localStorage.setItem('melhorenem_unique_user_id', id);
    }
    // Agora, o USER_ID será único para este navegador
    return id; 
}

// Inicializa o ID que será usado em todas as requisições
USER_ID = getOrCreateUniqueUserId();


// -----------------------------------------------------------
// 2. FUNÇÃO PRINCIPAL: CARREGAR DADOS DO DASHBOARD E LISTENERS
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Apenas carrega os dados se estiver na página dashboard.html
    if (document.getElementById('sumario-container')) {
        carregarDadosDashboard();
    }
    
    // E apenas preenche a redação se estiver na redacao.html
    if (document.getElementById('redacao-input')) {
        preencherRedacaoPorId();
    }
    
    // Listener do botão de correção e salvar/voltar 
    if (document.getElementById('btnCorrigir')) {
        document.getElementById('btnCorrigir').addEventListener('click', corrigirRedacao);
        document.getElementById('btnVoltarSalvar').addEventListener('click', salvarRascunho);
    }
});


async function carregarDadosDashboard() {
    try {
        // CORREÇÃO: O USER_ID dinâmico é usado aqui
        const response = await fetch(`${API_BASE_URL}/dashboard-data/${USER_ID}`); 
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro de Servidor' }));
            throw new Error(`Erro ao buscar dados: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        atualizarSumario(data.sumario);
        atualizarHistorico(data.historico);
        atualizarRascunhos(data.rascunhos); 

    } catch (error) {
        console.error("Erro ao carregar dados do Dashboard:", error);
        // Mensagem melhorada para lidar com o sleep do Render (Erro de conexão)
        alert(`AVISO: Falha ao carregar o Dashboard. Seu servidor Backend (Web Service) pode estar em modo 'sleep' no Render. \n\nAcesse a URL do seu backend diretamente em outra aba: https://corretor-melhorenem.onrender.com e tente novamente em 30s. \n\nDetalhes: ${error.message}`);
    }
}


// -----------------------------------------------------------
// 3. FUNÇÕES DE RENDERIZAÇÃO
// -----------------------------------------------------------

function atualizarSumario(sumario) {
    // CORREÇÃO: Usando as chaves que o backend deve retornar (total, nota_media, cX_media)
    document.getElementById('redacoes-corrigidas').textContent = sumario.total || 0; 
    document.getElementById('nota-media').textContent = sumario.nota_media || 0; 

    document.getElementById('media-c1').textContent = Math.round(sumario.c1_media || 0);
    document.getElementById('media-c2').textContent = Math.round(sumario.c2_media || 0);
    document.getElementById('media-c3').textContent = Math.round(sumario.c3_media || 0);
    document.getElementById('media-c4').textContent = Math.round(sumario.c4_media || 0);
    document.getElementById('media-c5').textContent = Math.round(sumario.c5_media || 0);
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
        // Usa redacao.redacao_id ou redacao.id dependendo do backend
        const id = redacao.redacao_id || redacao.id; 
        li.addEventListener('click', () => {
            abrirModalCorrecao(id); 
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
// 4. FUNÇÕES DO MODAL (DASHBOARD)
// -----------------------------------------------------------

async function abrirModalCorrecao(redacaoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/redacao/${redacaoId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes da correção.');
        }

        const data = await response.json();
        
        // NOVO: Adicionado para preencher o texto original no modal (se o HTML tiver o ID modal-texto-original)
        if(document.getElementById('modal-texto-original')) {
            document.getElementById('modal-texto-original').textContent = data.texto_original || 'Texto Original Indisponível';
        }
        
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
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }

    } catch (error) {
        console.error("Erro ao abrir modal de correção:", error);
        alert(`Erro ao carregar correção: ${error.message}`);
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-correcao');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300); 
    }
}

// -----------------------------------------------------------
// 5. FUNÇÕES DA PÁGINA REDACAO.HTML
// -----------------------------------------------------------

// Redireciona para a página de redação com o ID do rascunho
function carregarRascunhoNaPagina(id) {
    window.location.href = `redacao.html?rascunhoId=${id}`;
}

// Busca e preenche o textarea se houver um ID na URL (rascunho)
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
            
            // Limpa o parâmetro da URL
            history.replaceState({}, document.title, "redacao.html");

        } catch (error) {
            console.error("Erro ao carregar rascunho:", error);
            alert("Não foi possível carregar o rascunho. " + error.message);
        }
    }
}


// Lógica de correção (corrigida para enviar o USER_ID)
async function corrigirRedacao() {
    const redacaoInput = document.getElementById('redacao-input');
    const redacao = redacaoInput.value;
    const loading = document.getElementById('loading');
    const resultadoDiv = document.getElementById('correcao-resultado');
    const statusDiv = document.getElementById('status-message'); // Adicionado o statusDiv

    if (redacao.length < 50) {
        statusDiv.textContent = "O texto da redação é muito curto. Mínimo de 50 caracteres para correção.";
        return;
    }

    // Limpa e mostra a tela de carregamento (melhora usabilidade)
    resultadoDiv.style.display = 'none';
    statusDiv.textContent = '';
    loading.style.display = 'block'; 

    try {
        const response = await fetch(`${API_BASE_URL}/corrigir-redacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // CORREÇÃO ESSENCIAL: Envia o USER_ID para o backend
            body: JSON.stringify({ redacao: redacao, tema: "Tema não especificado pelo usuário", userId: USER_ID }) 
        });

        loading.style.display = 'none'; 
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao comunicar com o servidor. O Web Service pode estar dormindo.');
        }

        document.getElementById('nota-final').textContent = data.nota_final;
        document.getElementById('c1-score').textContent = data.c1_score;
        document.getElementById('c2-score').textContent = data.c2_score;
        document.getElementById('c3-score').textContent = data.c3_score;
        document.getElementById('c4-score').textContent = data.c4_score;
        document.getElementById('c5-score').textContent = data.c5_score;

        document.getElementById('feedback-detalhado').innerHTML = data.feedback_detalhado.replace(/\\n/g, '<br>');

        resultadoDiv.style.display = 'block';

    } catch (error) {
        loading.style.display = 'none'; 
        console.error("Erro na correção:", error);
        // Mensagem de erro amigável
        statusDiv.textContent = `Erro: Não foi possível corrigir. Verifique a URL da API ou se o backend está ativo. (Detalhes: ${error.message})`;
    } finally {
        loading.style.display = 'none';
    }
}

// Lógica de salvar rascunho (corrigida para enviar o USER_ID)
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
            // CORREÇÃO ESSENCIAL: Envia o USER_ID para o backend
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
