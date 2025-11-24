// ARQUIVO: server.js (Código Completo e Corrigido)

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'; 

// 1. CARREGAR VARIÁVEIS DE AMBIENTE
dotenv.config();

// ----------------------------------------------------------------
// 2. INICIALIZAÇÃO E CONFIGURAÇÃO DE SERVIÇOS
// ----------------------------------------------------------------

// A. INSTÂNCIA DO EXPRESS (DEFINIÇÃO CORRETA ANTES DO USO!)
const app = express();

// B. CONFIGURAÇÃO DO CORS (Solução do Erro CORS anterior)
const allowedOrigins = [
    // SUBSTITUA ISTO PELA URL EXATA DO SEU STATIC SITE NO RENDER:
    'https://corretor-melhorenem-frontend.onrender.com', 
    'http://localhost:3000' 
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};

// C. APLICAR MIDDLEWARE CORS e BODY PARSER
app.use(cors(corsOptions));
app.use(express.json()); 

// D. CONEXÃO COM O BANCO DE DADOS
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// E. INICIALIZAÇÃO DA GEMINI AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-2.5-flash"; 

// ----------------------------------------------------------------
// 3. FUNÇÕES DE BANCO DE DADOS (CORREÇÃO: createTables DEFINIDA)
// ----------------------------------------------------------------

// Função para criar as tabelas (Usando SERIAL PRIMARY KEY para PostgreSQL)
async function createTables() {
    // SQL Corrigido para PostgreSQL (SERIAL PRIMARY KEY e TEXT para LONGTEXT)
    const createTablesQuery = `
        -- Tabela de Usuários (Alunos)
        CREATE TABLE IF NOT EXISTS USUARIOS (
            usuario_id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabela de Redações Corrigidas
        CREATE TABLE IF NOT EXISTS REDACOES (
            redacao_id SERIAL PRIMARY KEY,
            usuario_id INT NOT NULL,
            data_submissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tema VARCHAR(255) NULL, 
            texto_original TEXT NOT NULL,
            nota_final INT NOT NULL,
            c1_score INT NOT NULL, 
            c2_score INT NOT NULL, 
            c3_score INT NOT NULL, 
            c4_score INT NOT NULL, 
            c5_score INT NOT NULL, 
            feedback_detalhado TEXT NOT NULL,
            
            FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id) ON DELETE CASCADE
        );

        -- Inserção de usuário de teste (Se não existir)
        INSERT INTO USUARIOS (usuario_id, nome, email) 
        VALUES (1, 'Aluno Teste', 'aluno@melhorenem.com.br')
        ON CONFLICT (usuario_id) DO NOTHING;
    `;
    
    // O pool.query pode executar múltiplos comandos SQL
    await pool.query(createTablesQuery);
}

// Função auxiliar para consultas SQL
async function dbQuery(text, params = []) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

// ----------------------------------------------------------------
// 4. ROTAS (Apenas o necessário para o teste)
// ----------------------------------------------------------------

// Rota de Correção de Redação (POST)
app.post('/api/corrigir-redacao', async (req, res) => {
    const { redacao, tema } = req.body;
    const usuario_id = 1; // ID fixo para o aluno de teste

    if (!redacao) {
        return res.status(400).json({ error: 'O campo "redacao" é obrigatório.' });
    }

    try {
        // ... Lógica de chamada à Gemini API para correção (aqui você insere seu prompt) ...
        const prompt = `Corrija a seguinte redação sobre o tema "${tema}" de acordo com os critérios do ENEM (Competências C1 a C5, com pontuação de 0 a 200 em cada). A nota final deve ser a soma das competências. O texto deve ser: "${redacao}". Retorne o resultado estritamente no formato JSON, sem nenhum texto introdutório ou explicativo fora do JSON. O JSON deve ter a seguinte estrutura: {"nota_final": N, "c1_score": N, "c2_score": N, "c3_score": N, "c4_score": N, "c5_score": N, "feedback_detalhado": "Texto com o feedback detalhado, incluindo quebras de linha com \\n"}.`;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json", // Solicita resposta em JSON
                temperature: 0.1,
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: HarmBlockThreshold.BLOCK_NONE,
                    },
                ],
            },
        });
        
        const jsonResponseText = response.text.trim();
        const correcaoData = JSON.parse(jsonResponseText);
        
        // Insere a correção no banco de dados
        const result = await dbQuery(
            `INSERT INTO REDACOES (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING redacao_id`,
            [
                usuario_id,
                tema,
                redacao,
                correcaoData.nota_final,
                correcaoData.c1_score,
                correcaoData.c2_score,
                correcaoData.c3_score,
                correcaoData.c4_score,
                correcaoData.c5_score,
                correcaoData.feedback_detalhado,
            ]
        );

        res.json(correcaoData);

    } catch (error) {
        console.error("Erro na correção ou no banco de dados:", error);
        res.status(500).json({ error: "Erro interno no servidor ao processar a correção.", details: error.message });
    }
});


// Rota para Salvar Rascunho (POST)
app.post('/api/salvar-rascunho', async (req, res) => {
    const { redacao } = req.body;
    const usuario_id = 1;

    try {
        const result = await dbQuery(
            `INSERT INTO REDACOES (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING redacao_id`,
            [usuario_id, 'Rascunho Sem Tema', redacao, 0, 0, 0, 0, 0, 0, 'Rascunho Salvo.']
        );
        res.json({ success: true, redacao_id: result.rows[0].redacao_id });
    } catch (error) {
        console.error("Erro ao salvar rascunho:", error);
        res.status(500).json({ error: 'Erro ao salvar rascunho.' });
    }
});


// Rota para Dashboard (GET) - Exemplo básico, ajuste conforme seu frontend precisa
app.get('/api/dashboard-data/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Obter sumário (média e total)
        const sumarioResult = await dbQuery(`
            SELECT 
                COUNT(redacao_id) AS total,
                ROUND(AVG(nota_final)) AS nota_media,
                ROUND(AVG(c1_score)) AS c1_media,
                ROUND(AVG(c2_score)) AS c2_media,
                ROUND(AVG(c3_score)) AS c3_media,
                ROUND(AVG(c4_score)) AS c4_media,
                ROUND(AVG(c5_score)) AS c5_media
            FROM REDACOES
            WHERE usuario_id = $1 AND nota_final > 0;
        `, [userId]);

        // Obter histórico de redações corrigidas (apenas as que têm nota)
        const historicoResult = await dbQuery(`
            SELECT redacao_id, tema, nota_final, TO_CHAR(data_submissao, 'DD/MM/YYYY') as data
            FROM REDACOES
            WHERE usuario_id = $1 AND nota_final > 0
            ORDER BY data_submissao DESC;
        `, [userId]);

        // Obter rascunhos (redações com nota 0)
        const rascunhosResult = await dbQuery(`
            SELECT redacao_id, 
                   SUBSTRING(texto_original FOR 50) || '...' as texto, 
                   TO_CHAR(data_submissao, 'DD/MM/YYYY') as data
            FROM REDACOES
            WHERE usuario_id = $1 AND nota_final = 0
            ORDER BY data_submissao DESC;
        `, [userId]);

        res.json({
            sumario: sumarioResult.rows[0] || {},
            historico: historicoResult.rows,
            rascunhos: rascunhosResult.rows
        });
    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard.' });
    }
});

// Rota para detalhe da Redação (GET) - Usado pelo Modal e para carregar rascunho
app.get('/api/redacao/:redacaoId', async (req, res) => {
    const { redacaoId } = req.params;

    try {
        const result = await dbQuery(
            `SELECT * FROM REDACOES WHERE redacao_id = $1`,
            [redacaoId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Redação não encontrada.' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Erro ao buscar detalhes da redação:", error);
        res.status(500).json({ error: 'Erro ao buscar detalhes da redação.' });
    }
});


// ----------------------------------------------------------------
// 5. INICIALIZAÇÃO DO SERVIDOR (CHAMADA DE createTables CORRIGIDA)
// ----------------------------------------------------------------

const PORT = process.env.PORT || 10000;

(async () => {
    try {
        await createTables(); // <--- AGORA ESTÁ DEFINIDO E SERÁ EXECUTADO!
        console.log("Conexão com o banco de dados PostgreSQL estabelecida com sucesso.");
        console.log("Tabelas verificadas/criadas com sucesso.");

        app.listen(PORT, () => {
            console.log(`Servidor de correção rodando na porta ${PORT}`);
            console.log(`Endpoint de correção: /api/corrigir-redacao`);
        });
    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
    }
})();
