// ARQUIVO: server.js (Substitua este código no seu Backend)

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // NOVO: Módulo CORS
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'; 

// 1. CARREGAR VARIÁVEIS DE AMBIENTE
dotenv.config();

// ----------------------------------------------------------------
// 2. INICIALIZAÇÃO E CONFIGURAÇÃO DE SERVIÇOS
// ----------------------------------------------------------------

// A. INSTÂNCIA DO EXPRESS (DEVE SER DEFINIDA AQUI)
const app = express(); // <--- ESTA LINHA DEVE VIR ANTES DE app.use(cors)

// B. CONFIGURAÇÃO DO CORS
// Configure a URL EXATA do seu Static Site (Frontend) aqui!
const allowedOrigins = [
    // SUBSTITUA ISTO PELA URL DO SEU FRONTEND NO RENDER:
    'https://corretor-melhorenem-frontend.onrender.com', 
    // Para testes locais (se necessário):
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

// C. APLICAR MIDDLEWARE CORS (Agora 'app' já está definido)
app.use(cors(corsOptions)); 
app.use(express.json()); // Body parser para JSON

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
// 3. FUNÇÕES DE BANCO DE DADOS
// ----------------------------------------------------------------

// (Mantenha suas funções db.query e createTables aqui)
// ...

// ----------------------------------------------------------------
// 4. ROTAS
// ----------------------------------------------------------------

// (Mantenha suas rotas /api/corrigir-redacao, /api/salvar-rascunho, etc. aqui)
// ...

// ----------------------------------------------------------------
// 5. INICIALIZAÇÃO DO SERVIDOR
// ----------------------------------------------------------------

const PORT = process.env.PORT || 10000;

// (Mantenha a função createTables aqui, se você a tiver)
// ...

// Exemplo da inicialização:
(async () => {
    try {
        await createTables(); // Se você tiver esta função
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
