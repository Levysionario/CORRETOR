// ARQUIVO: script.js (Substitua TODO o seu conteúdo por este)

// -----------------------------------------------------------
// 1. CONFIGURAÇÃO BASE
// -----------------------------------------------------------
const USER_ID = 1; 
const API_BASE_URL = 'https://corretor-melhorenem.onrender.com/api'; // CORREÇÃO: URL DO RENDER

// -----------------------------------------------------------
// 2. FUNÇÃO PRINCIPAL: CARREGAR DADOS DO DASHBOARD
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
});

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
        alert(`Essa página diz\nErro ao carregar os dados do dashboard. Verifique o servidor. (Detalhes: ${error.message})`);
    }
}


// -----------------------------------------------------------
// 3. FUNÇÕES DE RENDERIZAÇÃO 
// -----------------------------------------------------------

function atualizarSumario(sumario) {
    // A API retorna 'total', 'nota_media', 'c1_media', etc.
    document.getElementById('redacoes-corrigidas').textContent = sumario.total; 
    document.getElementById('nota-media').textContent = sumario.nota_media; 

    document.getElementById('media-c1').textContent = sumario.c1_media;
    document.getElementById('media-c2').textContent = sumario.c2_media;
    document.getElementById('media-c3').textContent = sumario.c3_media;
    document.getElementById('media-c4').textContent = sumario.c4_media;
    document.getElementById('media-c5').textContent = sumario.c5_media;
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
// 4. FUNÇÕES DO MODAL (DASHBOARD)
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

// Listener do botão de correção e salvar/voltar
if (document.getElementById('btnCorrigir')) {
    document.getElementById('btnCorrigir').addEventListener('click', corrigirRedacao);
    document.getElementById('btnVoltarSalvar').addEventListener('click', salvarRascunho);
}

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


// Lógica de correção (mantida)
async function corrigirRedacao() {
    const redacaoInput = document.getElementById('redacao-input');
    const redacao = redacaoInput.value;
    const resultadoDiv = document.getElementById('correcao-resultado');

    if (redacao.length < 50) {
        alert("O texto da redação é muito curto. Mínimo de 50 caracteres para correção.");
        return;
    }

    resultadoDiv.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/corrigir-redacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redacao: redacao, tema: "Tema não especificado pelo usuário" })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao comunicar com o servidor.');
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
        console.error("Erro na correção:", error);
        alert("Erro ao conectar ou processar a correção: " + error.message);
    }
}

// Lógica de salvar rascunho (mantida)
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
            body: JSON.stringify({ redacao: redacao })
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
