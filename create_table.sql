-- Este script SQL cria as tabelas necessárias para o projeto de correção de redações.
-- Ele é compatível com a sintaxe SQL padrão (utilizável em MySQL, PostgreSQL ou SQLite).

-- -----------------------------------------------------
-- Tabela de Usuários (Alunos)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS USUARIOS (
    usuario_id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Tabela de Redações Corrigidas
-- Esta tabela armazena a correção detalhada fornecida pela Gemini API
-- (que você está implementando no server.js).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS REDACOES (
    redacao_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Chave Estrangeira: vincula a redação a um usuário
    usuario_id INT NOT NULL,
    
    -- Dados da submissão
    data_submissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tema VARCHAR(255) NULL, -- Opcional, caso você adicione o tema depois
    texto_original LONGTEXT NOT NULL,
    
    -- Resultados da Correção (JSON da Gemini API)
    nota_final INT NOT NULL,
    c1_score INT NOT NULL, -- Competência 1: Domínio da norma padrão
    c2_score INT NOT NULL, -- Competência 2: Compreensão da proposta
    c3_score INT NOT NULL, -- Competência 3: Seleção e organização de informações
    c4_score INT NOT NULL, -- Competência 4: Demonstração de conhecimento
    c5_score INT NOT NULL, -- Competência 5: Elaboração de proposta de intervenção
    
    feedback_detalhado TEXT NOT NULL,
    
    -- Restrição de Chave Estrangeira
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- Exemplo de inserção para teste (opcional)
-- -----------------------------------------------------
/*
-- 1. Inserir um usuário
INSERT INTO USUARIOS (nome, email) VALUES ('Aluno Teste', 'aluno@melhorenem.com.br');

-- 2. Inserir uma redação (assumindo que o usuario_id = 1)
INSERT INTO REDACOES (usuario_id, tema, texto_original, nota_final, c1_score, c2_score, c3_score, c4_score, c5_score, feedback_detalhado)
VALUES (
    1,
    'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado...',
    'Na obra "Quarto de Despejo", a escritora Carolina Maria de Jesus...', -- Seu texto de teste
    1000,
    200, 200, 200, 200, 200,
    'Sua redação é exemplar em todas as competências avaliadas no ENEM, atingindo a nota máxima.'
);
*/