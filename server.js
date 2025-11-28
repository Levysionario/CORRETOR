// ARQUIVO: server.js (COMPLETO E CORRIGIDO)

import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
// Usar 'sqlite' para Promises com sqlite3
import sqlite3 from 'sqlite3';
import { open } from 'sqlite'; 

const app = express();
const port = process.env.PORT || 3000;

// Inicializa a Gemini API
// Certifique-se de que GEMINI_API_KEY esteja no seu arquivo .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-2.5-flash"; 

// Middleware
app.use(cors());
app.use(express.json());

let db;

// Funções utilitárias para o banco de dados
async function initializeDatabase() {
    try {
        db = await open({
            filename: './redacoes.db',
            driver: sqlite3.Database
        });

        // Cria a tabela USUARIOS (usando TEXT para o ID único do Frontend)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS USUARIOS (
                usuario_id TEXT PRIMARY KEY,
                data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Cria a tabela REDACOES
        await db.exec(`
            CREATE TABLE IF NOT EXISTS REDACOES (
                redacao_id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id TEXT NOT NULL,
                data_submissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                tema VARCHAR(255) NULL,
                texto_original LONGTEXT NOT NULL,
                
                -- Se nota_final for 0, é um rascunho
                nota_final INT DEFAULT 0, 
                c1_score INT DEFAULT 0,
                c2_score INT DEFAULT 0,
                c3_score INT DEFAULT 0,
                c4_score INT DEFAULT 0,
                c5_score INT DEFAULT 0,
                
                feedback_detalhado TEXT NULL,
                
                FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id) ON DELETE CASCADE
            );
        `);
        console.log('Banco de dados SQLite inicializado e tabelas verificadas.');
    } catch (e) {
        console.error("ERRO FATAL ao inicializar o banco de dados:", e);
    }
}

// Inicializa o banco de dados antes de iniciar o servidor
initializeDatabase();

// -----------------------------------------------------------
// ROTAS DE API (CORRIGIDAS COM 'return' NO TRATAMENTO DE ERROS)
// -----------------------------------------------------------

// Rota 1: Dashboard - Carrega sumário, histórico e rascunhos
app.get('/api/dashboard-data/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!db) {
        return res.status(500).json({ error: 'Conexão com o banco de dados não estabelecida.' });
    }

    try {
        // 1. Sumário (Calcula médias e total de corrigidas - nota_final > 0)
        const sumarioQuery = `
            SELECT 
                COUNT(redacao_id) AS total,
                COALESCE(AVG(nota_final), 0) AS nota_media,
                COALESCE(AVG(c1_score), 0) AS c1_media,
                COALESCE(AVG(c2_score), 0) AS c2_media,
                COALESCE(AVG(c3_score), 0) AS c3_media,
                COALESCE(AVG(c4_score), 0) AS c4_media,
                COALESCE(AVG(c5_score), 0) AS c5_media
            FROM REDACOES
            WHERE usuario_id = ? AND nota_final > 0;
        `;
        const sumario = await db.get(sumarioQuery, [userId]);

        // 2. Histórico (Redações corrigidas)
        const historico = await db.all(
            `SELECT redacao_id, tema, nota_final, DATE(data_submissao) as data 
             FROM REDACOES 
             WHERE usuario_id = ? AND nota_final > 0 
             ORDER BY data_submissao DESC`, 
            [userId]
        );

        // 3. Rascunhos (Redações salvas, nota_final = 0)
        const rascunhos = await db.all(
            `SELECT redacao_id, SUBSTR(texto_original, 1, 50) as texto, DATE(data_submissao) as data 
             FROM REDACOES 
             WHERE usuario_id = ? AND nota_final = 0
             ORDER BY data_submissao DESC`, 
            [userId]
        );

        res.json({
            sumario: sumario,
            historico: historico,
            rascunhos: rascunhos
        });

    } catch (error) {
        console.error(`Erro ao carregar dados do Dashboard para ${userId}:`, error.message);
        // FIX CRÍTICO: Usar 'return'
        return res.status(500).json({ error: 'Erro interno do servidor ao consultar o banco de dados.' }); 
    }
});


// Rota 2: Detalhes da Redação/Rascunho
app.get('/api/redacao/:id', async (req, res) => {
    const { id } = req.params;
    const redacaoId = parseInt(id, 10);

    if (!db) {
        return res.status(500).json({ error: 'Conexão com o banco de dados não estabelecida.' });
    }

    try {
        const query = `
            SELECT 
                redacao_id, usuario_id, tema, texto_original, 
                nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, 
                feedback_detalhado, DATE(data_submissao) as data
            FROM REDACOES 
            WHERE redacao_id = ?
        `;
        
        const row = await db.get(query, [redacaoId]);

        if (!row) {
            // FIX CRÍTICO: Usar 'return'
            return res.status(404).json({ error: "Redação não encontrada." });
        }
        
        res.status(200).json(row);

    } catch (error) {
        console.error("Erro ao buscar detalhes da redação:", error.message);
        // FIX CRÍTICO: Usar 'return'
        return res.status(500).json({ error: 'Erro interno ao buscar detalhes.' });
    }
});


// Rota 3: Salvar Rascunho
app.post('/api/salvar-rascunho', async (req, res) => {
    const { redacao, userId } = req.body;

    if (!redacao || !userId) {
        // FIX CRÍTICO: Usar 'return'
        return res.status(400).json({ error: 'Campos "redacao" e "userId" são obrigatórios.' });
    }

    if (!db) {
        return res.status(500).json({ error: 'Conexão com o banco de dados não estabelecida.' });
    }

    try {
        // Garante que o usuário exista
        await db.run('INSERT OR IGNORE INTO USUARIOS (usuario_id) VALUES (?)', [userId]);

        const insertQuery = `
            INSERT INTO REDACOES 
            (usuario_id, tema, texto_original) 
            VALUES (?, ?, ?)
        `;
        // Nota: nota_final e scores são 0 por padrão (definidos no CREATE TABLE), indicando rascunho.
        const result = await db.run(insertQuery, [userId, 'Rascunho Salvo', redacao]);

        res.status(201).json({ success: true, message: 'Rascunho salvo com sucesso!', redacaoId: result.lastID });

    } catch (error) {
        console.error("Erro ao salvar rascunho:", error.message);
        // FIX CRÍTICO: Usar 'return'
        return res.status(500).json({ error: 'Erro interno ao salvar rascunho.' });
    }
});


// Rota 4: Corrigir Redação com IA
app.post('/api/corrigir-redacao', async (req, res) => {
    const { redacao, tema, userId } = req.body;

    if (!redacao || !userId) {
        // FIX CRÍTICO: Usar 'return'
        return res.status(400).json({ error: 'Campos "redacao" e "userId" são obrigatórios.' });
    }

    if (!db) {
        return res.status(500).json({ error: 'Conexão com o banco de dados não estabelecida.' });
    }

    try {
        // 1. Garante que o usuário exista
        await db.run('INSERT OR IGNORE INTO USUARIOS (usuario_id) VALUES (?)', [userId]);

        // 2. Cria o Prompt
        const prompt = `
            Você é um corretor de redações especialista do ENEM, focado estritamente nas 5 Competências (C1 a C5).
            A redação a seguir é do tema: "${tema}".
            
            Sua tarefa é:
            1. Atribuir Pontuações (0 a 200) para cada uma das 5 competências.
            2. Fornecer um feedback detalhado. Use o caractere '\\n' para quebras de linha no feedback detalhado.
            3. Retornar o resultado EXCLUSIVAMENTE em formato JSON.

            Redação: "${redacao}"

            Estrutura JSON esperada:
            {
                "nota_final": [Nota total (soma das 5 competências)],
                "c1_score": [Pontuação C1],
                "c2_score": [Pontuação C2],
                "c3_score": [Pontuação C3],
                "c4_score": [Pontuação C4],
                "c5_score": [Pontuação C5],
                "feedback_detalhado": "[Seu feedback formatado com '\\n']"
            }
        `;

        // 3. Chamada da Gemini API
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        // Extrai o JSON da resposta (usa regex para garantir que pega o objeto completo)
        const jsonText = response.text.match(/\{[\s\S]*\}/)?.[0];

        if (!jsonText) {
            // FIX CRÍTICO: Usar 'return'
            return res.status(500).json({ error: 'A Gemini IA não retornou o JSON no formato esperado.' });
        }

        const correctionResult = JSON.parse(jsonText);
        
        if (!correctionResult || !correctionResult.nota_final) {
            // FIX CRÍTICO: Usar 'return'
            return res.status(500).json({ error: 'O JSON retornado pela IA está inválido ou incompleto.' });
        }

        // 4. Salva a correção no banco de dados
        const insertQuery = `
            INSERT INTO REDACOES 
            (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.run(insertQuery, [
            userId,
            tema,
            redacao,
            correctionResult.nota_final,
            correctionResult.c1_score,
            correctionResult.c2_score,
            correctionResult.c3_score,
            correctionResult.c4_score,
            correctionResult.c5_score,
            correctionResult.feedback_detalhado
        ]);
        
        // 5. Retorna o resultado de sucesso
        res.status(200).json(correctionResult);

    } catch (error) {
        console.error("Erro GERAL no /corrigir-redacao (IA ou DB):", error);
        // FIX CRÍTICO: Usar 'return'
        return res.status(500).json({ error: "Erro na correção com a Gemini IA. Verifique sua chave API, o log do servidor, e o formato da resposta JSON." });
    }
});


// Inicia o servidor Express
app.listen(port, () => {
    console.log(`Backend rodando em http://localhost:${port}`);
});
