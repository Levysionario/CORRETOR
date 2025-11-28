// ARQUIVO: server.js (BACKEND COMPLETO E FINAL COM CORREÇÃO DE MODULOS)

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
// Importação de módulos Node nativos para contornar o problema de sqlite3 com ESM
import { createRequire } from 'module';
import path from 'path';

// CORREÇÃO CRÍTICA: Cria uma função 'require' para carregar módulos CommonJS (como sqlite3)
const require = createRequire(import.meta.url);
const sqlite3Module = require('sqlite3');
const sqlite3 = sqlite3Module.verbose(); // Carrega sqlite3 com a sintaxe CJS para estabilidade

// --- CONFIGURAÇÃO ---
const app = express();
const PORT = process.env.PORT || 3000;
// Se o banco de dados não existir, ele será criado
const DB_PATH = path.join(process.cwd(), 'redacoes_db.sqlite'); 


// Inicializa o cliente Gemini usando a chave da variável de ambiente
if (!process.env.GEMINI_API_KEY) {
    console.warn("AVISO: Variável de ambiente GEMINI_API_KEY não definida. A API de correção não funcionará.");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-2.5-flash"; // Modelo rápido e eficiente

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json()); 

// --- BANCO DE DADOS (SQLite) ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Erro ao conectar ao SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS REDACOES (
            redacao_id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT NOT NULL,         -- Chave de Privacidade
            data_submissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tema VARCHAR(255) NULL,
            texto_original LONGTEXT NOT NULL,
            
            -- Resultados da Correção
            nota_final INT,
            c1_score INT,
            c2_score INT,
            c3_score INT,
            c4_score INT,
            c5_score INT,
            feedback_detalhado TEXT,
            
            -- Status: 0 = Corrigida, 1 = Rascunho
            is_rascunho BOOLEAN NOT NULL DEFAULT 1 
        );
    `, (err) => {
        if (err) {
            console.error("Erro ao criar tabela REDACOES:", err.message);
        } else {
            console.log("Tabela REDACOES verificada/criada.");
        }
    });
}


// ----------------------------------------------------------------------
// 1. LÓGICA DE CORREÇÃO (GEMINI API)
// ----------------------------------------------------------------------

const correctionPrompt = (redacao) => `
    Você é um corretor de redações especialista na metodologia ENEM.
    Sua única tarefa é analisar a redação fornecida e gerar uma nota e um feedback estruturado.

    Regras de Pontuação (0 a 200 para cada competência):
    - C1: Domínio da norma-padrão.
    - C2: Compreensão da proposta e aplicação de conceitos.
    - C3: Seleção, organização e interpretação de fatos e opiniões.
    - C4: Demonstração de conhecimento dos mecanismos linguísticos (coesão).
    - C5: Elaboração de proposta de intervenção.

    A nota final é a soma das 5 competências.

    A redação para análise é:
    ---
    ${redacao}
    ---

    Gere o resultado em formato JSON estrito, seguindo exatamente o seguinte esquema.
    Não inclua NENHUM texto extra antes ou depois do JSON.

    JSON Schema:
    {
      "nota_final": number,
      "c1_score": number,
      "c2_score": number,
      "c3_score": number,
      "c4_score": number,
      "c5_score": number,
      "feedback_detalhado": string (Um texto que resume os pontos fortes e fracos em cada competência. Use '\\n' para quebras de linha.)
    }
`;

async function getCorrection(redacao) {
    if (!process.env.GEMINI_API_KEY) {
         throw new Error("Chave API não configurada. A correção da IA não pode ser realizada.");
    }
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: correctionPrompt(redacao),
            config: {
                responseMimeType: "application/json", 
                responseSchema: {
                    type: "object",
                    properties: {
                        nota_final: { type: "number" },
                        c1_score: { type: "number" },
                        c2_score: { type: "number" },
                        c3_score: { type: "number" },
                        c4_score: { type: "number" },
                        c5_score: { type: "number" },
                        feedback_detalhado: { type: "string" }
                    },
                    required: ["nota_final", "c1_score", "c2_score", "c3_score", "c4_score", "c5_score", "feedback_detalhado"]
                }
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Erro na chamada da API Gemini:", error.message);
        throw new Error("Falha na correção da IA. Verifique a chave API ou o modelo.");
    }
}


// ----------------------------------------------------------------------
// 2. ROTAS API
// ----------------------------------------------------------------------

// ROTA 1: POST para corrigir e salvar a redação
app.post('/api/corrigir-redacao', async (req, res) => {
    const { redacao, tema, userId } = req.body;

    if (!redacao || !userId) {
        return res.status(400).json({ error: "Redação ou ID de usuário ausente." });
    }

    try {
        // 1. Chama a IA para correção
        const correctionResult = await getCorrection(redacao);

        // 2. Salva o resultado no Banco de Dados
        const insertQuery = `
            INSERT INTO REDACOES (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado, is_rascunho) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;
        
        // USO DO userId PARA PRIVACIDADE
        db.run(insertQuery, [
            userId,
            tema || 'Tema não especificado',
            redacao,
            correctionResult.nota_final,
            correctionResult.c1_score,
            correctionResult.c2_score,
            correctionResult.c3_score,
            correctionResult.c4_score,
            correctionResult.c5_score,
            correctionResult.feedback_detalhado
        ], function(err) {
            if (err) {
                console.error("Erro ao inserir correção no DB:", err.message);
                return res.status(200).json({...correctionResult, warning: "Correção realizada, mas falha ao salvar no histórico."});
            }
            
            res.status(200).json(correctionResult);
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ROTA 2: POST para salvar rascunho
app.post('/api/salvar-rascunho', (req, res) => {
    const { redacao, userId } = req.body;

    if (!redacao || !userId) {
        return res.status(400).json({ error: "Redação ou ID de usuário ausente." });
    }

    const insertQuery = `
        INSERT INTO REDACOES (usuario_id, texto_original, tema, is_rascunho, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score) 
        VALUES (?, ?, ?, 1, 0, 0, 0, 0, 0, 0)
    `;
    
    // USO DO userId PARA PRIVACIDADE
    db.run(insertQuery, [userId, redacao, 'Rascunho'], function(err) {
        if (err) {
            console.error("Erro ao salvar rascunho:", err.message);
            return res.status(500).json({ error: "Erro interno ao salvar rascunho." });
        }
        res.status(200).json({ success: true, message: "Rascunho salvo.", id: this.lastID });
    });
});


// ROTA 3: GET para dados do Dashboard
app.get('/api/dashboard-data/:userId', async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ error: "ID de usuário ausente." });
    }

    try {
        // 1. Sumário (Médias e Total)
        const sumarioQuery = `
            SELECT 
                COUNT(CASE WHEN is_rascunho = 0 THEN redacao_id END) AS total, 
                AVG(CASE WHEN is_rascunho = 0 THEN nota_final END) AS nota_media,
                AVG(CASE WHEN is_rascunho = 0 THEN c1_score END) AS c1_media,
                AVG(CASE WHEN is_rascunho = 0 THEN c2_score END) AS c2_media,
                AVG(CASE WHEN is_rascunho = 0 THEN c3_score END) AS c3_media,
                AVG(CASE WHEN is_rascunho = 0 THEN c4_score END) AS c4_media,
                AVG(CASE WHEN is_rascunho = 0 THEN c5_score END) AS c5_media
            FROM REDACOES 
            WHERE usuario_id = ?; -- FILTRO ESSENCIAL
        `;
        
        const sumario = await new Promise((resolve, reject) => {
            db.get(sumarioQuery, [userId], (err, row) => {
                if (err) reject(err);
                if (row) {
                    for (const key in row) {
                        if (key.includes('_media') && row[key] !== null) {
                            row[key] = Math.round(row[key]);
                        }
                    }
                }
                resolve(row || {});
            });
        });

        // 2. Histórico de CORREÇÕES
        const historicoQuery = `
            SELECT redacao_id, tema, nota_final, strftime('%d/%m/%Y', data_submissao) as data 
            FROM REDACOES 
            WHERE usuario_id = ? AND is_rascunho = 0 -- FILTRO ESSENCIAL
            ORDER BY data_submissao DESC;
        `;
        const historico = await new Promise((resolve, reject) => {
            db.all(historicoQuery, [userId], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        // 3. Rascunhos Salvos
        const rascunhosQuery = `
            SELECT redacao_id, SUBSTR(texto_original, 1, 50) as texto, strftime('%d/%m/%Y', data_submissao) as data 
            FROM REDACOES 
            WHERE usuario_id = ? AND is_rascunho = 1 -- FILTRO ESSENCIAL
            ORDER BY data_submissao DESC;
        `;
        const rascunhos = await new Promise((resolve, reject) => {
            db.all(rascunhosQuery, [userId], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });

        res.status(200).json({ sumario, historico, rascunhos });

    } catch (error) {
        console.error("Erro no Dashboard:", error.message);
        res.status(500).json({ error: "Erro interno ao carregar dados do dashboard." });
    }
});


// ROTA 4: GET para detalhes de uma redação (rascunho ou correção)
app.get('/api/redacao/:id', async (req, res) => {
    const redacaoId = req.params.id;

    const query = `
        SELECT * FROM REDACOES 
        WHERE redacao_id = ?;
    `;
    
    db.get(query, [redacaoId], (err, row) => {
        if (err) {
            console.error("Erro ao buscar detalhes da redação:", err.message);
            return res.status(500).json({ error: "Erro interno ao buscar detalhes." });
        }
        if (!row) {
            return res.status(404).json({ error: "Redação não encontrada." });
        }
        
        res.status(200).json(row);
    });
});


// ----------------------------------------------------------------------
// 3. INICIALIZAÇÃO DO SERVIDOR
// ----------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

