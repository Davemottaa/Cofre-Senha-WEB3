/**
 * ===============================================
 * COFRE WEB3 SEGURO - DOCUMENTAÇÃO TÉCNICA
 * ===============================================
 * 
 * Aplicação Web3 para gerenciamento de senhas
 * descentralizado usando Ethereum Sepolia Testnet
 * 
 * STACK TÉCNICO:
 * - Frontend: HTML5, CSS3, JavaScript Vanilla
 * - Web3: ethers.js v5.7.2
 * - Encriptação: CryptoJS AES-256
 * - Blockchain: Ethereum Sepolia (ChainId: 11155111)
 * - Wallet: MetaMask (com suporte mobile)
 * 
 * ===============================================
 */

// ===============================================
// SEÇÃO 1: VARIÁVEIS GLOBAIS
// ===============================================
/**
 * Variáveis que mantêm o estado da aplicação
 * durante toda a sessão do utilizador
 */

/** @type {string|null} Chave de encriptação AES-256 derivada da assinatura MetaMask */
let encryptionKey = null;

/** @type {string} Último estado dos dados sincronizados com blockchain */
let lastSyncedData = "";

/** @type {number|null} ID do timeout para limpar senhas visíveis */
let visiblePasswordTimeout = null;

/** @type {string|null} Endereço Ethereum do utilizador conectado (ex: 0x...) */
let currentUser = null;

/** @type {boolean} Flag indicando se utilizador está na rede Sepolia */
let isOnCorrectNetwork = false;

/** @type {number|null} ID da rede Ethereum (11155111 = Sepolia) */
let currentNetworkChainId = null;


// ===============================================
// SEÇÃO 2: RESTAURAÇÃO DE SESSÃO
// ===============================================
/**
 * Recupera dados da sessão anterior armazenados em sessionStorage
 * Executado quando página carrega para verificar login antigo
 * 
 * @returns {boolean} true se sessão foi restaurada, false se não
 * 
 * FLUXO:
 * 1. Verifica sessionStorage por dados de sessão
 * 2. Se encontra, restaura variáveis globais
 * 3. Mostra interface da aplicação
 * 4. Carrega senhas do blockchain
 */
function restoreSessionData() {
    // Buscar dados armazenados na sessão anterior
    const saved = sessionStorage.getItem('encryption_key');
    const savedUser = sessionStorage.getItem('current_user');
    const savedChainId = sessionStorage.getItem('current_chain_id');
    
    // Validar que todos os dados necessários existem
    if (saved && savedUser && savedChainId) {
        // Restaurar estado global
        encryptionKey = saved;
        currentUser = savedUser;
        currentNetworkChainId = parseInt(savedChainId);
        isOnCorrectNetwork = true;
        
        console.log(`✅ Sessão restaurada para ${currentUser}`);
        
        // Mostrar interface da aplicação (esconder login)
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        
        // Mostrar endereço do utilizador
        document.getElementById('user-address').innerText = 
            `${currentUser.substring(0, 6)}...${currentUser.substring(38)} (Sepolia)`;
        
        // Carregar senhas da blockchain
        downloadFromBlockchain();
        return true;
    }
    return false;
}


// ===============================================
// SEÇÃO 3: CONFIGURAÇÃO DE REDES E CONTRATOS
// ===============================================
/**
 * Configuração das redes Ethereum suportadas
 * Cada rede tem seu endereço de contrato específico
 */
const SUPPORTED_NETWORKS = {
    11155111: { // Sepolia Testnet - ChainId 11155111
        name: 'Sepolia Testnet',
        contractAddress: '0x95D234085B83Ec63487CF37Df6DF5Fae0B6D4be6',
        rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY'
    }
    // Nota: Mainnet removido propositalmente para evitar enviar ETH real por acidente
};

/**
 * Obtém o endereço do smart contract para a rede atual
 * Com validação em 6 camadas para prevenir erros
 * 
 * @returns {string|null} Endereço do contrato (42 chars com 0x) ou null se inválido
 * 
 * VALIDAÇÕES:
 * 1. currentNetworkChainId não é null
 * 2. currentNetworkChainId é um número
 * 3. Rede está em SUPPORTED_NETWORKS
 * 4. Endereço existe e não é placeholder "0x..."
 * 5. Endereço tem 42 caracteres (válido no Ethereum)
 */
function getContractAddressForCurrentNetwork() {
    // Validação 1: ChainId não pode ser null
    if (!currentNetworkChainId) {
        console.error('❌ ERRO: currentNetworkChainId é null!');
        console.error('   validateNetwork() não foi executada com sucesso.');
        return null;
    }
    
    // Validação 2: ChainId deve ser número
    if (typeof currentNetworkChainId !== 'number') {
        console.error(`❌ ERRO: ChainId não é número! Tipo: ${typeof currentNetworkChainId}`);
        return null;
    }
    
    // Validação 3: Rede deve estar suportada
    const network = SUPPORTED_NETWORKS[currentNetworkChainId];
    if (!network) {
        console.error(`❌ ERRO: Rede ${currentNetworkChainId} não suportada!`);
        console.error(`   Redes suportadas: ${Object.keys(SUPPORTED_NETWORKS).join(', ')}`);
        return null;
    }
    
    // Validação 4 e 5: Endereço não vazio, não placeholder, 42 chars
    const contractAddr = network.contractAddress;
    if (!contractAddr || contractAddr === '0x...' || contractAddr.length < 42) {
        console.error(`❌ ERRO: Endereço inválido: ${contractAddr}`);
        return null;
    }
    
    console.log(`✅ Usando contrato da ${network.name}: ${contractAddr}`);
    return contractAddr;
}

/**
 * ABI (Application Binary Interface) do smart contract
 * Define os métodos disponíveis no contrato inteligente
 */
const abi = [
    {
        // Função: salvarCofre(string memory _novosDados)
        // Propósito: Guardar dados criptografados no blockchain
        "inputs": [{ "internalType": "string", "name": "_novosDados", "type": "string" }],
        "name": "salvarCofre",
        "outputs": [],
        "stateMutability": "nonpayable", // Não requer ETH
        "type": "function"
    },
    {
        // Função: recuperarCofre() returns (string memory)
        // Propósito: Ler dados criptografados do blockchain
        "inputs": [],
        "name": "recuperarCofre",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view", // Apenas leitura, não modifica estado
        "type": "function"
    }
];


// ===============================================
// SEÇÃO 4: FUNÇÕES UTILITÁRIAS E VALIDAÇÃO
// ===============================================
/**
 * Sanitiza string removendo tags HTML maliciosas
 * Previne ataques XSS ao exibir nomes de sites
 * 
 * @param {string} str - String a sanitizar
 * @returns {string} String segura sem tags HTML
 */
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str; // textContent não interpreta HTML
    return div.innerHTML;   // Agora é seguro retornar como HTML
}

/**
 * Exibe modal de erro com mensagem customizada
 * 
 * @param {string} title - Título do erro (ex: "❌ Erro ao Conectar")
 * @param {string} message - Mensagem detalhada para o utilizador
 * 
 * COMPORTAMENTO:
 * 1. Loga erro no console para debugging
 * 2. Mostra modal visual com titulo e mensagem
 * 3. Fecha automaticamente após 3 segundos
 */
function showError(title, message) {
    console.error(`[${title}] ${message}`);
    showProcessing(title, message); // Reutiliza modal de status
    setTimeout(hideProcessing, 3000); // Fechar após 3s
}

/**
 * Valida entrada de nova senha antes de guardar
 * Verifica limites de tamanho e formato
 * 
 * @param {string} site - Nome do site/aplicação
 * @param {string} user - Utilizador ou email
 * @param {string} pass - Senha
 * @returns {boolean} true se válido, false se inválido
 * 
 * VALIDAÇÕES:
 * - Site: 1-100 caracteres (obrigatório)
 * - Senha: 4-128 caracteres (obrigatório)
 * - Utilizador: máximo 255 caracteres (opcional)
 */
function validatePasswordEntry(site, user, pass) {
    // Validar nome do site
    if (!site?.trim() || site.length > 100) {
        showError(
            "❌ Nome do Site Inválido",
            "Escreva nome do site (máximo 100 caracteres).\nExemplo: Facebook, Gmail, Amazon..."
        );
        return false;
    }
    
    // Validar senha
    if (pass.length < 4 || pass.length > 128) {
        showError(
            "❌ Senha Inválida",
            "Senha deve ter entre 4 e 128 caracteres."
        );
        return false;
    }
    
    // Validar utilizador (opcional)
    if (user && user.length > 255) {
        showError(
            "❌ Utilizador Muito Longo",
            "Máximo 255 caracteres para utilizador."
        );
        return false;
    }
    
    return true;
}

/**
 * Valida que utilizador está na rede Sepolia
 * Obtém rede atual da MetaMask e verifica ChainId
 * 
 * @returns {Promise<boolean>} true se está na Sepolia, false caso contrário
 * 
 * FLUXO:
 * 1. Cria provider ethers.js
 * 2. Força atualização de cache com detectNetwork()
 * 3. Obtém rede atual da MetaMask
 * 4. Verifica se ChainId (11155111) está em SUPPORTED_NETWORKS
 * 5. Se correto: guarda ChainId e retorna true
 * 6. Se errado: mostra erro e retorna false
 */
async function validateNetwork() {
    try {
        // Criar provider com 'any' para permitir qualquer rede
        const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        
        // Forçar detecção de rede (não usar cache)
        await provider.detectNetwork();
        
        // Obter rede atual
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        
        console.log(`📊 Rede detectada: ${network.name} (ChainId: ${chainId})`);
        
        // Verificar se rede está suportada
        if (!SUPPORTED_NETWORKS[chainId]) {
            console.error(`❌ ERRO: ChainId ${chainId} não suportada!`);
            showError(
                "❌ Rede Errada",
                `Está na rede ${network.name}.\n\n` +
                `Deve mudar para SEPOLIA na MetaMask:\n` +
                `1. Clique no ícone MetaMask\n` +
                `2. Selecione "Redes"\n` +
                `3. Escolha "Sepolia Testnet"`
            );
            isOnCorrectNetwork = false;
            currentNetworkChainId = null;
            return false;
        }
        
        // ✅ Rede válida - guardar ChainId
        currentNetworkChainId = chainId;
        isOnCorrectNetwork = true;
        console.log(`✅ Rede VALIDADA: ${SUPPORTED_NETWORKS[chainId].name}`);
        return true;
        
    } catch (e) {
        console.error('❌ Erro ao validar rede:', e);
        showError("❌ Erro na Rede", "Não conseguimos verificar a rede. Tente novamente.");
        currentNetworkChainId = null;
        return false;
    }
}

/**
 * Listener que recarrega página se utilizador trocar de rede na MetaMask
 * Garante que aplicação não opera em rede errada
 */
if (window.ethereum) {
    window.ethereum.on('chainChanged', () => {
        console.log('🔄 Rede foi alterada! Recarregando...');
        location.reload(); // Recarregar página inteira
    });
}

/**
 * Limpa todos os dados sensíveis da memória e armazenamento
 * Executado ao fazer logout
 * 
 * LIMPA:
 * - Variáveis globais (chaves, utilizador, chainId)
 * - localStorage (senhas criptografadas, hashes)
 * - sessionStorage (será feito no logout)
 * - Inputs do formulário
 * - Timouts pendentes
 */
function secureClear() {
    // Limpar variáveis globais
    encryptionKey = null;
    currentUser = null;
    lastSyncedData = "";
    currentNetworkChainId = null;
    
    // Remover dados de localStorage
    localStorage.removeItem('my_passwords');
    localStorage.removeItem('last_synced_data');
    localStorage.removeItem('last_sync_hash');
    
    // Limpar inputs do formulário
    document.getElementById('siteName').value = "";
    document.getElementById('siteUser').value = "";
    document.getElementById('sitePass').value = "";
    document.getElementById('passwordList').innerHTML = "";
    document.getElementById('btn-copy-generated').style.display = 'none';
    
    // Cancelar timeout de auto-ocultação de senha
    clearTimeout(visiblePasswordTimeout);
}


// ===============================================
// SEÇÃO 5: ENCRIPTAÇÃO E ARMAZENAMENTO LOCAL
// ===============================================
/**
 * Recupera dados encriptados do localStorage
 * Desencripta usando AES-256 com chave derivada de assinatura
 * 
 * @param {string} key - Chave no localStorage (ex: 'my_passwords')
 * @returns {Array|null} Dados desencriptados ou null se erro
 * 
 * FLUXO:
 * 1. Verifica se chave de encriptação existe
 * 2. Obtém dados encriptados de localStorage
 * 3. Desencripta com CryptoJS AES-256
 * 4. Converte bytes para UTF-8
 * 5. Faz parse JSON
 * 6. Retorna array de senhas
 */
function getLocalStorageEncrypted(key) {
    try {
        // Verificar se chave existe
        if (!encryptionKey) {
            console.error('Chave de encriptação não disponível');
            return null;
        }
        
        // Obter dados encriptados
        const encrypted = localStorage.getItem(key);
        if (!encrypted) return null;
        
        // Desencriptar com AES-256
        const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey);
        if (!decrypted || decrypted.length === 0) {
            console.error('Falha ao desencriptar - dados vazios');
            return null;
        }
        
        // Converter para string UTF-8
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
        return JSON.parse(plaintext);
        
    } catch (e) {
        console.error('Erro ao desencriptar localStorage:', e);
        return null;
    }
}

/**
 * Armazena dados encriptados no localStorage
 * Encripta usando AES-256 com chave derivada de assinatura
 * 
 * @param {string} key - Chave no localStorage
 * @param {Array} data - Dados a encriptar (array de senhas)
 * @throws {Error} Se falhar ao encriptar
 */
function setLocalStorageEncrypted(key, data) {
    try {
        // Converter dados para JSON e encriptar
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(data),
            encryptionKey
        ).toString();
        
        // Armazenar no localStorage
        localStorage.setItem(key, encrypted);
        
    } catch (e) {
        console.error('Erro ao encriptar localStorage:', e);
        throw e;
    }
}

/**
 * Calcula hash SHA-256 dos dados para detecção de mudanças
 * Usado para verificar se dados foram sincronizados
 * 
 * @param {Array} data - Dados a hashear
 * @returns {string} Hash SHA-256 em formato hexadecimal
 */
function calculateHash(data) {
    return CryptoJS.SHA256(JSON.stringify(data)).toString();
}


// ===============================================
// SEÇÃO 6: TEMA E INTERFACE
// ===============================================
/**
 * Alterna entre modo claro e escuro
 * Guarda preferência em localStorage
 */
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        // Trocar para claro
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        // Trocar para escuro
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

/**
 * Carrega tema guardado ao iniciar aplicação
 */
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}


// ===============================================
// SEÇÃO 7: MODAL E INTERFACE VISUAL
// ===============================================
/**
 * Mostra modal de status com spinner e mensagem
 * Usado para mostrar progresso (conectando, guardando, etc)
 * 
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem descritiva
 */
function showProcessing(title, message) {
    document.getElementById('status-title').innerText = title;
    document.getElementById('status-msg').innerText = message;
    document.getElementById('status-modal').style.display = 'flex';
}

/** Esconde o modal de status */
function hideProcessing() {
    document.getElementById('status-modal').style.display = 'none';
}

/**
 * Mostra qualquer modal pelo ID
 * @param {string} id - ID do modal HTML
 */
function showModal(id) {
    document.getElementById(id).style.display = 'flex';
}

/**
 * Esconde qualquer modal pelo ID
 * @param {string} id - ID do modal HTML
 */
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}


// ===============================================
// SEÇÃO 8: ENCRIPTAÇÃO AES-256
// ===============================================
/**
 * Encripta array de senhas com AES-256
 * 
 * @param {Array} data - Array de objetos {id, site, user, pass}
 * @returns {string} Dados encriptados em formato base64
 */
function encryptFull(data) {
    return CryptoJS.AES.encrypt(
        JSON.stringify(data),
        encryptionKey
    ).toString();
}

/**
 * Desencripta dados que foram guardados no blockchain
 * 
 * @param {string} cipher - Dados encriptados em base64
 * @returns {Array|null} Array de senhas ou null se erro
 * 
 * VALIDAÇÕES:
 * 1. Cipher não vazio e é string
 * 2. Cipher tem tamanho mínimo (>20 chars)
 * 3. Chave de encriptação existe
 * 4. Desencriptação bem-sucedida
 * 5. Parse JSON válido
 */
function decryptFull(cipher) {
    try {
        // Validação 1-2: Cipher válido
        if (!cipher || typeof cipher !== 'string' || cipher.length < 20) {
            console.error('Cifra inválida ou corrompida');
            return null;
        }
        
        // Validação 3: Chave existe
        if (!encryptionKey) {
            console.error('Chave de encriptação não disponível');
            return null;
        }
        
        // Desencriptar
        const bytes = CryptoJS.AES.decrypt(cipher, encryptionKey);
        
        // Validação 4: Resultado válido
        if (!bytes || bytes.length === 0) {
            console.error('Falha ao desencriptar - dados vazios');
            return null;
        }
        
        // Converter para UTF-8 e fazer parse JSON
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(plaintext);
        
    } catch (e) {
        console.error('Erro ao desencriptar dados:', e);
        return null;
    }
}


// ===============================================
// SEÇÃO 9: WEB3 E AUTENTICAÇÃO
// ===============================================
/**
 * Conecta à carteira MetaMask
 * Funcionamento diferente em mobile vs desktop
 * 
 * FLUXO:
 * 1. Detectar se é mobile ou desktop
 * 2. Se mobile e sem MetaMask: abrir deep link
 * 3. Se desktop e sem MetaMask: mostrar erro com instruções
 * 4. Se tem MetaMask:
 *    a. Validar que está em Sepolia
 *    b. Pedir acesso à conta
 *    c. Pedir assinatura de mensagem
 *    d. Gerar chave encriptação a partir de assinatura
 *    e. Guardar sessão em sessionStorage
 *    f. Carregar senhas do blockchain
 */
async function connectWallet() {
    try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        console.log(`📱 Detectado: ${isMobile ? 'Mobile' : 'Desktop'}`);
        
        // NOVO: Diagnosticar problema
        console.log('🔍 DIAGNÓSTICO:');
        console.log(`  - window.ethereum existe? ${!!window.ethereum}`);
        console.log(`  - HTTPS? ${window.location.protocol === 'https:'}`);
        console.log(`  - Domínio: ${window.location.hostname}`);
        console.log(`  - URL completa: ${window.location.href}`);
        
        if (!window.ethereum) {
            console.warn('⚠️ window.ethereum NÃO ENCONTRADO!');
            console.warn('  Causas possíveis:');
            console.warn('  1. Página via HTTP (precisa HTTPS)');
            console.warn('  2. MetaMask não está instalada');
            console.warn('  3. Content Security Policy está a bloquear');
            console.warn('  4. Injeção de script foi bloqueada');
            
            if (isMobile) {
                showProcessing("📱 Abrindo MetaMask...", "Redirecionando para o app...");
                setTimeout(() => {
                    window.location.href = "https://metamask.app.link/dapp/" + 
                                         window.location.hostname;
                }, 1500);
                return;
            } else {
                showError(
                    "❌ MetaMask Não Encontrada",
                    "Você precisa instalar a extensão MetaMask.\n\n" +
                    "IMPORTANTE:\n" +
                    "✓ Certifique-se de que está usando HTTPS\n" +
                    "✓ Recarregue a página (Ctrl+Shift+R)\n" +
                    "✓ Se continuar, tente em outro navegador"
                );
                return;
            }
        }
        
        showProcessing("🔐 A Conectar à Carteira", 
                      "Por favor, confirme na janela da MetaMask que aparece.");
        const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        await provider.detectNetwork();
        
        if (!await validateNetwork()) {
            hideProcessing();
            return;
        }
        
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        currentUser = await signer.getAddress();
        
        const message = `Aceder ao Cofre Seguro\nConta: ${currentUser}`;
        showProcessing("✍️ A Assinar Mensagem", 
                      "Confirme a assinatura na MetaMask (isto é seguro).");
        const sig = await signer.signMessage(message);
        
        encryptionKey = ethers.utils.keccak256(sig);
        
        sessionStorage.setItem('encryption_key', encryptionKey);
        sessionStorage.setItem('current_user', currentUser);
        sessionStorage.setItem('current_chain_id', currentNetworkChainId.toString());
        
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('user-address').innerText = 
            `${currentUser.substring(0, 6)}...${currentUser.substring(38)} (Sepolia)`;
        
        showProcessing("📥 A Carregar Senhas", "Buscando na blockchain...");
        await downloadFromBlockchain();
        
    } catch (e) {
        console.error('❌ Erro ao conectar:', e);
        console.error('Detalhes:', {
            message: e.message,
            code: e.code,
            stack: e.stack
        });
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            showError(
                "❌ Erro de Conexão",
                "Verifique que:\n" +
                "✓ MetaMask app está instalada\n" +
                "✓ Você clicou em \"Conectar\"\n" +
                "✓ Está na rede Sepolia\n\n" +
                "Se continuar com erro, reinstale MetaMask."
            );
        } else {
            showError(
                "❌ Erro ao Conectar",
                "Não conseguimos conectar à sua carteira.\n\n" +
                "Certifique-se de que:\n" +
                "✓ MetaMask está instalada\n" +
                "✓ Você clicou em \"Confirmar\"\n" +
                "✓ Está na rede Sepolia\n" +
                "✓ A página usa HTTPS"
            );
        }
    }
}

/**
 * Listener que restaura sessão quando volta do app MetaMask
 * Importante para mobile: volta do app para browser
 */
window.addEventListener('focus', () => {
    console.log('👀 Voltou ao app - verificando conexão...');
    if (window.ethereum && currentUser) {
        console.log('✅ MetaMask conectada!');
    }
});

/**
 * Faz logout seguro do utilizador
 * Pede confirmação e limpa todos os dados sensíveis
 */
function logout() {
    // Mostrar modal de confirmação
    showModal('logout-modal');
    
    document.getElementById('confirm-logout-btn').onclick = () => {
        closeModal('logout-modal');
        
        // Limpeza segura de TODOS os dados sensíveis
        secureClear();
        sessionStorage.clear(); // Também limpar sessionStorage
        
        // Esconder aplicação, mostrar login
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
        isOnCorrectNetwork = false;
        
        // Mostrar confirmação
        showProcessing("Desconectado", "Até à próxima!");
        setTimeout(hideProcessing, 1500);
    };
}


// ===============================================
// SEÇÃO 10: OPERAÇÕES COM BLOCKCHAIN
// ===============================================
/**
 * Guarda nova senha no blockchain e localStorage
 * Processa: validação → encriptação → blockchain → cache local
 * 
 * FLUXO:
 * 1. Validar entrada (site, utilizador, senha)
 * 2. Verificar que está na rede Sepolia
 * 3. Obter array de senhas do localStorage
 * 4. Adicionar nova senha ao array
 * 5. Encriptar todo o array com AES-256
 * 6. Chamar função blockchain: contract.salvarCofre()
 * 7. Aguardar confirmação da transação
 * 8. Guardar no localStorage e recalcular hash
 * 9. Mostrar na interface
 * 10. Limpar formulário
 */
async function saveAndSync() {
    const site = document.getElementById('siteName').value.trim();
    const user = document.getElementById('siteUser').value.trim();
    const pass = document.getElementById('sitePass').value;

    // 1. Validar entrada
    if (!validatePasswordEntry(site, user, pass)) {
        return;
    }
    
    // 2. Verificar rede
    if (!isOnCorrectNetwork) {
        showError("❌ Rede Errada", 
                 "Você não está na rede Sepolia!\n\n" +
                 "Por favor:\n1. Abra a MetaMask\n" +
                 "2. Mude para Sepolia Testnet\n" +
                 "3. Tente novamente");
        return;
    }

    try {
        showProcessing("💾 A Guardar a Senha", 
                      "Encriptando e guardando com segurança...");
        
        // 3. Obter senhas existentes
        let passwords = getLocalStorageEncrypted('my_passwords') || [];
        
        // 4. Adicionar nova senha
        passwords.push({ 
            id: Date.now(), 
            site, 
            user, 
            pass 
        });
        
        // 5. Encriptar
        const enc = encryptFull(passwords);

        // 6. Preparar transação blockchain
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddr = getContractAddressForCurrentNetwork();
        
        if (!contractAddr) {
            showError("❌ Erro de Configuração", 
                     "Não conseguimos obter o endereço do contrato.");
            return;
        }
        
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            showError("❌ Erro de Configuração", 
                     "Endereço do contrato inválido.");
            return;
        }
        
        console.log(`📝 Guardando para contrato: ${contractAddr}`);
        
        // 7-8. Executar transação e aguardar confirmação
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const tx = await contract.salvarCofre(enc);
        
        showProcessing("⏳ Confirmando na Internet", 
                      "A rede está a confirmar. Isto pode demorar alguns segundos...");
        await tx.wait();

        // 9. Guardar no localStorage
        setLocalStorageEncrypted('my_passwords', passwords);
        lastSyncedData = enc;
        localStorage.setItem('last_sync_hash', calculateHash(passwords));
        
        // 10. Atualizar interface
        renderPasswords();
        showProcessing("✅ Sucesso!", "A sua senha foi guardada com segurança!");
        setTimeout(hideProcessing, 2000);
        
        // 11. Limpar formulário
        document.getElementById('siteName').value = "";
        document.getElementById('siteUser').value = "";
        document.getElementById('sitePass').value = "";
        document.getElementById('btn-copy-generated').style.display = 'none';
        
    } catch (e) {
        console.error('❌ ERRO ao guardar:', e);
        showError("❌ Erro ao Guardar", 
                 "Não conseguimos guardar a senha. Tente novamente.\n" +
                 "Erro: " + (e.message || "Desconhecido"));
    }
}

/**
 * Carrega senhas do blockchain e atualiza aplicação
 * Primeiro ponto de carregamento de dados após login
 * 
 * FLUXO:
 * 1. Conectar ao blockchain via ethers.js
 * 2. Obter endereço do contrato para rede atual
 * 3. Chamar função: contract.recuperarCofre()
 * 4. Se tem dados:
 *    a. Desencriptar com chave do utilizador
 *    b. Guardar no localStorage como cache
 *    c. Calcular hash para sincronização
 * 5. Se sem dados: mostrar mensagem "Nenhuma senha guardada"
 * 6. Renderizar lista de senhas na interface
 */
async function downloadFromBlockchain() {
    try {
        showProcessing("📥 A Carregar Senhas", 
                      "Procurando na blockchain. Por favor, aguarde...");
        
        // 1-2. Conectar e obter contrato
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddr = getContractAddressForCurrentNetwork();
        
        if (!contractAddr) {
            showError("❌ Erro de Configuração", 
                     "Não conseguimos obter o endereço do contrato.");
            return;
        }
        
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            showError("❌ Erro de Configuração", 
                     "Endereço do contrato inválido.");
            return;
        }
        
        console.log(`📥 Carregando do contrato: ${contractAddr}`);
        
        // 3. Chamar função blockchain
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const data = await contract.recuperarCofre();
        
        // 4. Processar dados
        if(data && data.length > 20) {
            // 4a. Desencriptar
            const dec = decryptFull(data);
            if (dec) {
                // 4b. Guardar em cache local
                setLocalStorageEncrypted('my_passwords', dec);
                lastSyncedData = data;
                
                // 4c. Calcular hash de sincronização
                localStorage.setItem('last_sync_hash', calculateHash(dec));
                console.log(`✅ ${dec.length} senhas carregadas!`);
            } else {
                showError("⚠️ Dados Corrompidos", 
                         "Problema ao ler os dados. Tente novamente mais tarde.");
                return;
            }
        } else {
            // 5. Sem dados
            console.log('ℹ️ Nenhuma senha guardada ainda.');
            showProcessing("✅ Tudo Pronto!", 
                          "Nenhuma senha guardada. Pode começar a adicionar agora.");
            setTimeout(hideProcessing, 2000);
        }
        
        // 6. Renderizar na interface
        renderPasswords();
        if(data && data.length > 20) hideProcessing();
        
    } catch (e) {
        console.error('❌ ERRO ao carregar:', e);
        showError("❌ Erro ao Carregar", 
                 "Não conseguimos aceder aos dados.\n" +
                 "Verifique a ligação à Internet e tente novamente.");
    }
}


// ===============================================
// SEÇÃO 11: RENDERIZAÇÃO E INTERAÇÃO COM SENHAS
// ===============================================
/**
 * Renderiza lista visual de senhas guardadas
 * Mostra cada senha em card com botões (Ver, Copiar, Apagar)
 * Senhas visíveis são automaticamente ocultadas após 30 segundos
 * 
 * @param {number|null} openId - ID da senha que deve estar visível (null = todas ocultadas)
 */
function renderPasswords(openId = null) {
    const list = document.getElementById('passwordList');
    const passwords = getLocalStorageEncrypted('my_passwords') || [];
    const statusText = document.getElementById('sync-status-text');

    // Limpar lista anterior
    list.innerHTML = '';
    
    // Calcular status de sincronização
    const currentHash = calculateHash(passwords);
    const lastHash = localStorage.getItem('last_sync_hash') || '';
    
    // Mostrar status
    statusText.innerHTML = (lastHash && currentHash === lastHash) 
        ? "<span style='color:var(--success)'>✅ Todas as suas senhas estão guardadas com segurança na Internet</span>" 
        : "<span style='color:var(--warning)'>⚠️ Tem senhas novas que ainda não foram guardadas. Clique em \"Guardar\".</span>";

    // Criar card para cada senha
    passwords.forEach(p => {
        const isOpen = p.id === openId;
        
        // Container da senha
        const card = document.createElement('div');
        card.className = 'pass-card';
        
        // Mostrar senha (ocultada com • ou visível)
        const passDisplay = document.createElement('div');
        passDisplay.className = 'pass-display';
        passDisplay.textContent = isOpen ? p.pass : '••••••••';
        
        // Info do site e utilizador
        const passInfo = document.createElement('div');
        passInfo.className = 'pass-info';
        passInfo.innerHTML = `<b>${sanitizeHTML(p.site)}</b><br><small>${sanitizeHTML(p.user || 'Sem utilizador')}</small>`;
        
        card.appendChild(passInfo);
        card.appendChild(passDisplay);
        
        // Botões de ação
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group-card';
        
        // Botão Ver
        const btnVer = document.createElement('button');
        btnVer.className = 'btn-card btn-ver';
        btnVer.innerHTML = '<i class="fas fa-eye"></i> Ver';
        btnVer.onclick = () => askToView(p.id);
        btnGroup.appendChild(btnVer);
        
        // Botão Copiar (aparece apenas se senha está visível)
        if (isOpen) {
            const btnCopiar = document.createElement('button');
            btnCopiar.className = 'btn-card btn-copiar';
            btnCopiar.innerHTML = '<i class="fas fa-copy"></i> Copiar';
            btnCopiar.onclick = () => copyToClipboard(p.pass);
            btnGroup.appendChild(btnCopiar);
        }
        
        // Botão Apagar
        const btnApagar = document.createElement('button');
        btnApagar.className = 'btn-card btn-apagar';
        btnApagar.innerHTML = '<i class="fas fa-trash"></i> Apagar';
        btnApagar.onclick = () => askToDelete(p.id);
        btnGroup.appendChild(btnApagar);
        
        card.appendChild(btnGroup);
        list.appendChild(card);
    });
    
    // Auto-ocultação de senha após 30 segundos
    if (openId) {
        clearTimeout(visiblePasswordTimeout);
        visiblePasswordTimeout = setTimeout(() => {
            renderPasswords(null);
            showProcessing("Aviso", "Senha ocultada por segurança.");
            setTimeout(hideProcessing, 1500);
        }, 30000);
    }
}

/**
 * Pede confirmação para ver senha
 * Modal de segurança avisa que senha será visível
 * 
 * @param {number} id - ID da senha a visualizar
 */
function askToView(id) {
    showModal('security-modal');
    document.getElementById('confirm-view-btn').onclick = () => {
        closeModal('security-modal');
        renderPasswords(id); // Mostrar essa senha
    };
}

/**
 * Copia senha para clipboard (Ctrl+V)
 * Usa API moderna Clipboard API
 * 
 * @param {string} txt - Texto (senha) a copiar
 */
function copyToClipboard(txt) {
    navigator.clipboard.writeText(txt).then(() => {
        showProcessing("✓ Copiado!", 
                      "Senha copiada para a memória. Pode colar em qualquer lugar (Ctrl+V).");
        setTimeout(hideProcessing, 2000);
    }).catch(() => {
        showError("❌ Erro na Cópia", 
                 "Não conseguimos copiar a senha. Tente novamente.");
    });
}

/**
 * Pede confirmação para apagar senha
 * Modal avisa que ação é permanente
 * 
 * @param {number} id - ID da senha a apagar
 */
function askToDelete(id) {
    showModal('delete-modal');
    document.getElementById('confirm-delete-btn').onclick = async () => {
        closeModal('delete-modal');
        await deleteAndSync(id);
    };
}

/**
 * Apaga senha do blockchain e localStorage
 * Sincroniza mudança para blockchain
 * 
 * @param {number} id - ID da senha a apagar
 */
async function deleteAndSync(id) {
    showProcessing("⏳ A Eliminar a Senha", 
                  "Removendo com segurança. Por favor, aguarde...");
    try {
        // Obter senhas, remover a especificada
        let passwords = getLocalStorageEncrypted('my_passwords') || [];
        passwords = passwords.filter(p => p.id !== id);
        
        // Encriptar e atualizar blockchain
        const enc = encryptFull(passwords);
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddr = getContractAddressForCurrentNetwork();
        
        if (!contractAddr) {
            showError("❌ Erro de Configuração", 
                     "Não conseguimos obter o endereço do contrato.");
            return;
        }
        
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            showError("❌ Erro de Configuração", 
                     "Endereço do contrato inválido.");
            return;
        }
        
        console.log(`🗑️ Apagando senha do contrato: ${contractAddr}`);
        
        // Executar transação
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const tx = await contract.salvarCofre(enc);
        await tx.wait();
        
        // Atualizar cache local
        setLocalStorageEncrypted('my_passwords', passwords);
        lastSyncedData = enc;
        localStorage.setItem('last_sync_hash', calculateHash(passwords));
        
        // Atualizar interface
        renderPasswords();
        showProcessing("✅ Eliminada!", 
                      "A senha foi removida de forma permanente.");
        setTimeout(hideProcessing, 1500);
        
    } catch (e) {
        console.error('❌ ERRO ao apagar:', e);
        showError("❌ Erro ao Eliminar", 
                 "Não conseguimos remover a senha. Tente mais tarde.");
    }
}


/**
 * Mostra modal com gerador de senhas automático
 */
function showPasswordGenerator() {
    showModal('generator-modal');
}

/**
 * Gera senha aleatória com opções customizáveis
 * Suporta: minúsculas, MAIÚSCULAS, números, símbolos
 * 
 * FLUXO:
 * 1. Obter opções do utilizador (tamanho, tipos de caracteres)
 * 2. Construir string de caracteres disponíveis
 * 3. Gerar senha escolhendo aleatoriamente
 * 4. Colocar no campo de senha
 * 5. Mostrar botão "Copiar"
 * 6. Calcular força da senha
 */
function generateRandomPass() {
    // 1. Obter configurações
    const length = parseInt(document.getElementById('pass-length').value) || 14;
    const useLower = document.getElementById('pass-lower').checked;
    const useUpper = document.getElementById('pass-upper').checked;
    const useNumbers = document.getElementById('pass-numbers').checked;
    const useSymbols = document.getElementById('pass-symbols').checked;

    // 2. Construir pool de caracteres
    let chars = "";
    if (useLower) chars += "abcdefghjkmnpqrstuvwxyz";      // Sem i,l,o (evitar confusão)
    if (useUpper) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ";      // Sem I,O
    if (useNumbers) chars += "23456789";                     // Sem 0,1 (evitar confusão)
    if (useSymbols) chars += "!@#$%&*";

    // Validar que pelo menos um tipo foi selecionado
    if (!chars) {
        showError("❌ Nenhuma Opção", 
                 "Selecione pelo menos uma opção (letras, números ou símbolos).");
        return;
    }

    // 3. Gerar senha
    let newPass = "";
    for (let i = 0; i < length; i++) {
        newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // 4. Colocar no campo
    document.getElementById('sitePass').value = newPass;
    
    // 5. Mostrar botão copiar
    document.getElementById('btn-copy-generated').style.display = 'flex';
    closeModal('generator-modal');
    
    // 6. Calcular força e mostrar mensagem
    const strength = length > 16 ? 'Muito Forte' : length > 12 ? 'Forte' : 'Segura';
    showProcessing("✨ Senha Gerada!", 
                  `Pronta a usar! Força: ${strength} (${length} caracteres)`);
    setTimeout(hideProcessing, 2000);
}

/**
 * Copia senha gerada para clipboard
 */
function copyGeneratedPass() {
    const passValue = document.getElementById('sitePass').value;
    if (passValue) {
        navigator.clipboard.writeText(passValue).then(() => {
            showProcessing("✓ Copiado!", 
                          "A senha foi copiada com sucesso.");
            setTimeout(hideProcessing, 1500);
        }).catch(() => {
            showError("❌ Erro", 
                     "Não conseguimos copiar a senha. Tente novamente.");
        });
    }
}


// ===============================================
// SEÇÃO 13: INICIALIZAÇÃO
// ===============================================
/**
 * Executado quando página carrega completamente
 * Inicializa aplicação e restaura sessão anterior se existir
 */
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar tema (claro/escuro)
    initTheme();
    
    // Tentar restaurar sessão anterior
    if (!restoreSessionData()) {
        console.log('Nenhuma sessão anterior. Aguardando login...');
    }
});