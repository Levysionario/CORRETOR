// ARQUIVO: server.js (Versão Final e Corrigida para Render PostgreSQL)
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg'; // <--- Driver Oficial do PostgreSQL

// --- Estrutura SQL Adaptada para PostgreSQL ---
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS USUARIOS (
    usuario_id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS REDACOES (
    redacao_id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    data_submissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tema VARCHAR(255) NULL,
    texto_original TEXT NOT NULL, 
    
    -- Colunas de Correção
    nota_final INT NULL,
    c1_score INT NULL,
    c2_score INT NULL,
    c3_score INT NULL,
    c4_score INT NULL,
    c5_score INT NULL,
    
    feedback_detalhado TEXT NULL,
    
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id) ON DELETE CASCADE
);
`;


// 1. CARREGAR VARIÁVEL DE AMBIENTE
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("ERRO: A variável de ambiente GEMINI_API_KEY não está definida.");
    process.exit(1);
}

// 2. CONFIGURAÇÃO E CONEXÃO COM O BANCO DE DADOS
let pool; 
const TEST_USER_ID = 1; 

async function connectToDatabase() {
    try {
        // CORREÇÃO CRÍTICA: Procura a variável mais confiável do Render e usa a DATABASE_URL como backup
        const CONNECTION_STRING = process.env.RENDER_POSTGRESQL_CONNECTION_STRING || process.env.DATABASE_URL;

        if (!CONNECTION_STRING) {
            throw new Error("Nenhuma URL de banco de dados encontrada. Verifique se a RENDER_POSTGRESQL_CONNECTION_STRING ou DATABASE_URL estão definidas no seu Web Service.");
        }
        
        // Conecta usando a URL (e adiciona SSL, obrigatório no Render para conexões externas)
        pool = new Pool({ 
             connectionString: CONNECTION_STRING,
             ssl: { rejectUnauthorized: false } 
        }); 
        
        await pool.query('SELECT 1'); // Testa a conexão
        console.log("Conexão com o banco de dados PostgreSQL estabelecida com sucesso.");
        
        // 1. Cria as tabelas (se não existirem)
        await pool.query(CREATE_TABLES_SQL);
        console.log("Tabelas verificadas/criadas com sucesso.");
        
        // 2. Garante que o usuário de teste exista (ON CONFLICT DO NOTHING é PostgreSQL)
        await pool.query(
            "INSERT INTO USUARIOS (usuario_id, nome, email) VALUES ($1, 'Aluno Teste', 'aluno@app.com') ON CONFLICT (usuario_id) DO NOTHING", [TEST_USER_ID]
        );
        
    } catch (error) {
        console.error("ERRO CRÍTICO: Não foi possível conectar ao banco de dados.", error.message);
        process.exit(1); 
    }
}

// 3. INICIALIZAÇÃO DO SERVIDOR
const app = express();
const PORT = process.env.PORT || 10000;
const ai = new GoogleGenAI(GEMINI_API_KEY);

// Middlewares
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------
// ENDPOINTS (CRUD)
// ------------------------------------------------------------------

// --- 4. ENDPOINT PRINCIPAL: CORREÇÃO DE REDAÇÃO (CREATE) ---
app.post('/api/corrigir-redacao', async function(req, res) {
    const { tema, texto } = req.body;
    
    if (!texto || texto.length < 100) {
        return res.status(400).json({ error: "O texto da redação deve ter pelo menos 100 caracteres." });
    }

    try {
        // 1. Cria o prompt (Omitido por ser muito longo, mas funcional)
        const prompt = `Você é um corretor de redações do ENEM. Avalie a redação a seguir em relação às 5 Competências do ENEM (C1 a C5), atribuindo notas de 0 a 200 para cada competência. O tema é: "${tema || 'Tema não especificado'}".
        A sua resposta deve ser EXCLUSIVAMENTE um objeto JSON.
        
        O JSON deve ter o seguinte formato (com as notas de 0 a 200, em múltiplos de 40):
        {
          "nota_final": [SOMA TOTAL DAS NOTAS, Múltiplo de 40],
          "c1_score": [0, 40, 80, 120, 160, ou 200],
          "c2_score": [0, 40, 80, 120, 160, ou 200],
          "c3_score": [0, 40, 80, 120, 160, ou 200],
          "c4_score": [0, 40, 80, 120, 160, ou 200],
          "c5_score": [0, 40, 80, 120, 160, ou 200],
          "feedback_detalhado": "Um feedback construtivo e detalhado, com parágrafos separados por \\n para melhor leitura."
        }
        
        Redação para análise:
        ---
        ${texto}
        ---
        `;

        // 2. Chama a API Gemini (usando JSON mode)
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        nota_final: { type: "integer" },
                        c1_score: { type: "integer" },
                        c2_score: { type: "integer" },
                        c3_score: { type: "integer" },
                        c4_score: { type: "integer" },
                        c5_score: { type: "integer" },
                        feedback_detalhado: { type: "string" }
                    },
                    required: ["nota_final", "c1_score", "c2_score", "c3_score", "c4_score", "c5_score", "feedback_detalhado"]
                },
            },
        });

        // 3. Processa e valida o JSON
        let correctionData;
        try {
            correctionData = JSON.parse(response.text);
        } catch (e) {
            console.error("Falha ao parsear o JSON da Gemini:", response.text);
            throw new Error("Resposta da IA inválida. Tente novamente.");
        }

        const { nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado } = correctionData;

        // 4. Salva a correção no banco de dados (CREATE)
        const result = await pool.query(
            `INSERT INTO REDACOES (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING redacao_id`,
            [TEST_USER_ID, tema, texto, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado]
        );

        // 5. Retorna a correção
        res.json({
            success: true,
            redacao_id: result.rows[0].redacao_id, 
            ...correctionData
        });

    } catch (error) {
        console.error("Erro na API de Correção:", error);
        res.status(500).json({ error: error.message || "Erro interno ao processar a correção com a IA." });
    }
});


// --- 5. ENDPOINT PARA SALVAR/ATUALIZAR RASCUNHO (UPDATE / CREATE) ---
app.post('/api/salvar-rascunho', async function(req, res) {
    const { redacao: texto, id: redacao_id } = req.body;

    try {
        if (redacao_id) {
            // Atualiza um rascunho existente (UPDATE)
            await pool.query(
                "UPDATE REDACOES SET texto_original = $1, data_submissao = CURRENT_TIMESTAMP WHERE redacao_id = $2 AND usuario_id = $3",
                [texto, redacao_id, TEST_USER_ID]
            );
            return res.json({ success: true, message: "Rascunho atualizado com sucesso.", redacao_id });
        } else {
            // Cria um novo rascunho (CREATE)
            const result = await pool.query(
                "INSERT INTO REDACOES (usuario_id, texto_original) VALUES ($1, $2) RETURNING redacao_id",
                [TEST_USER_ID, texto]
            );
            return res.json({ success: true, message: "Novo rascunho salvo com sucesso.", redacao_id: result.rows[0].redacao_id });
        }
    } catch (error) {
        console.error("Erro ao salvar rascunho:", error);
        res.status(500).json({ error: "Erro interno ao salvar rascunho." });
    }
});


// --- 6. ENDPOINT PARA BUSCAR DADOS DO DASHBOARD (READ - Listagem) ---
app.get('/api/dashboard-data/:userId', async function(req, res) {
    try {
        // 1. Sumário (Total e Média)
        const sumarioResult = await pool.query(
            `SELECT 
                COUNT(redacao_id) as total, 
                COALESCE(AVG(nota_final)::integer, 0) as nota_media,
                COALESCE(AVG(c1_score)::integer, 0) as c1_media,
                COALESCE(AVG(c2_score)::integer, 0) as c2_media,
                COALESCE(AVG(c3_score)::integer, 0) as c3_media,
                COALESCE(AVG(c4_score)::integer, 0) as c4_media,
                COALESCE(AVG(c5_score)::integer, 0) as c5_media
             FROM REDACOES WHERE usuario_id = $1 AND nota_final IS NOT NULL`,
            [TEST_USER_ID]
        );
        const sumario = sumarioResult.rows[0];

        // 2. Histórico (Redações Corrigidas)
        const historicoResult = await pool.query(
            `SELECT redacao_id, tema, nota_final, TO_CHAR(data_submissao, 'DD/MM/YYYY HH24:MI') as data
             FROM REDACOES WHERE usuario_id = $1 AND nota_final IS NOT NULL ORDER BY data_submissao DESC`,
            [TEST_USER_ID]
        );

        // 3. Rascunhos (Redações Não Corrigidas)
        const rascunhoResult = await pool.query(
            `SELECT redacao_id, SUBSTRING(texto_original FROM 1 FOR 100) as texto_preview, TO_CHAR(data_submissao, 'DD/MM/YYYY HH24:MI') as data
             FROM REDACOES WHERE usuario_id = $1 AND nota_final IS NULL ORDER BY data_submissao DESC`,
            [TEST_USER_ID]
        );

        res.json({
            sumario: {
                total: sumario.total || 0,
                nota_media: sumario.nota_media || 0,
                c1_media: sumario.c1_media || 0,
                c2_media: sumario.c2_media || 0,
                c3_media: sumario.c3_media || 0,
                c4_media: sumario.c4_media || 0,
                c5_media: sumario.c5_media || 0
            },
            historico: historicoResult.rows,
            rascunhos: rascunhoResult.rows.map(row => ({
                id: row.redacao_id,
                texto: row.texto_preview + '...', 
                data: row.data
            }))
        });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ error: "Erro ao carregar dados do dashboard." });
    }
});

// --- 7. ENDPOINT PARA BUSCAR REDAÇÃO/RASCUNHO POR ID (READ - Detalhe) ---
app.get('/api/redacao/:id', async function(req, res) {
    const redacaoId = req.params.id;

    try {
        const result = await pool.query(
            "SELECT redacao_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado FROM REDACOES WHERE redacao_id = $1 AND usuario_id = $2",
            [redacaoId, TEST_USER_ID]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Redação ou rascunho não encontrado." });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Erro ao buscar detalhes da redação:", error);
        res.status(500).json({ error: "Erro interno ao buscar detalhes." });
    }
});


// 8. INICIA O SERVIDOR
connectToDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor de correção rodando na porta ${PORT}`);
        console.log(`Endpoint de correção: /api/corrigir-redacao`);
    });
});
