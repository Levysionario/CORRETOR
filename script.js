// ARQUIVO: script.js (COMPLETO E CORRIGIDO)

// -----------------------------------------------------------
// 1. CONFIGURAÇÃO BASE E GESTÃO DE USUÁRIO (Simulação de Contas)
// -----------------------------------------------------------
// MUDE ESTA URL APENAS SE O SEU BACKEND NÃO ESTIVER NESTE DOMÍNIO PADRÃO DO RENDER
const API_BASE_URL = 'https://corretor-melhorenem.onrender.com/api'; 
let USER_ID; 

// Função para obter ou criar um ID de usuário único
function getOrCreateUserId() {
    let id = localStorage.getItem('melhorenem_user_id');
    if (!id) {
        // Gera um ID grande (simulando um usuário logado) e salva no navegador
        id = Date.now().toString() + Math.floor(Math.random() * 9999);
        localStorage.setItem('melhorenem_user_id', id);
    }
    // NOTA: No backend atual, estamos forçando o usuario_id = 1 para evitar quebras.
    // Retornamos 1 por segurança até que o backend seja ajustado para aceitar IDs dinâmicos.
    return 1; 
}

USER_ID = getOrCreateUserId();


// -----------------------------------------------------------
// 2. INICIALIZAÇÃO E EVENTOS
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Carrega o dashboard
    if (document.getElementById('sumario-container')) {
        carregarDadosDashboard();
    }
    // Carrega a página de redação
    if (document.getElementById('redacao-input')) {
        preencherRedacaoPorId();
        
        document.getElementById('btnCorrigir').addEventListener('click', corrigirRedacao);
        document.getElementById('btnVoltarSalvar').addEventListener('click', salvarRascunho);
    }
    
    // Adicionar funcionalidade de fechar modal (necessário se o HTML não tiver o onclick)
    const modal = document.getElementById('modal-correcao');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-btn')) {
                fecharModal();
            }
        });
    }
});

// -----------------------------------------------------------
// 3. FUNÇÃO PRINCIPAL: CARREGAR DADOS DO DASHBOARD
// -----------------------------------------------------------

async function carregarDadosDashboard() {
    try {
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
// 4. FUNÇÕES DE RENDERIZAÇÃO DE DADOS (Corrigido o erro de NULL)
// -----------------------------------------------------------

function atualizarSumario(sumario) {
    // Certifique-se de que o elemento existe antes de tentar preenchê-lo
    if (document.getElementById('redacoes-corrigidas')) {
        document.getElementById('redacoes-corrigidas').textContent = sumario.total || 0; 
    }
    if (document.getElementById('nota-media')) {
        document.getElementById('nota-media').textContent = sumario.nota_media || 0; 
    }

    // Corrigido para verificar se os IDs de competência existem
    const compIds = ['media-c1', 'media-c2', 'media-c3', 'media-c4', 'media-c5'];
    const compKeys = ['c1_media', 'c2_media', 'c3_media', 'c4_media', 'c5_media'];
    
    compIds.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            // Arredonda para não mostrar decimais no dashboard
            element.textContent = Math.round(sumario[compKeys[index]] || 0); 
        }
    });
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
        // Usa o texto do rascunho. O SQL já deve ter cortado para 50 caracteres.
        li.innerHTML = `
            <div>
                <span class="rascunho-texto">${rascunho.texto}</span>
                <span class="data-historico">(${rascunho.data})</span>
            </div>
            <button onclick="carregarRascunhoNaPagina(${rascunho.redacao_id})" class="btn-cta-small">Abrir</button>
        `;
        listElement.appendChild(li);
    });
}

// -----------------------------------------------------------
// 5. FUNÇÕES DO MODAL E REDACAO.HTML
// -----------------------------------------------------------

async function abrirModalCorrecao(redacaoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/redacao/${redacaoId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes da correção.');
        }

        const data = await response.json();
        
        // Preenche o modal
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
        if(modal) {
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
            
            // Remove o parâmetro da URL para não recarregar no refresh
            history.replaceState({}, document.title, "redacao.html"); 

        } catch (error) {
            console.error("Erro ao carregar rascunho:", error);
            alert("Não foi possível carregar o rascunho. " + error.message);
        }
    }
}

async function corrigirRedacao() {
    const redacaoInput = document.getElementById('redacao-input');
    const redacao = redacaoInput.value;
    const resultadoDiv = document.getElementById('correcao-resultado');
    const statusDiv = document.getElementById('status-message');
    const loadingDiv = document.getElementById('loading-message'); 

    if (redacao.length < 50) {
        statusDiv.textContent = "O texto da redação é muito curto. Mínimo de 50 caracteres para correção.";
        return;
    }

    // Limpa e mostra a tela de carregamento (melhora usabilidade)
    resultadoDiv.style.display = 'none';
    statusDiv.textContent = '';
    loadingDiv.style.display = 'block'; 

    try {
        const response = await fetch(`${API_BASE_URL}/corrigir-redacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Envia o USER_ID para o backend
            body: JSON.stringify({ redacao: redacao, tema: "Tema não especificado", userId: USER_ID }) 
        });

        loadingDiv.style.display = 'none'; 
        
        // Tentativa de ler o JSON, mesmo que haja erro (para pegar a mensagem)
        const data = await response.json();

        if (!response.ok) {
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
        loadingDiv.style.display = 'none'; 
        console.error("Erro na correção:", error);
        // Mensagem de erro amigável
        statusDiv.textContent = `Erro: Não foi possível corrigir. Verifique a URL da API ou se o backend está ativo. (Detalhes: ${error.message})`;
    }
}

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
            // Envia o USER_ID
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
