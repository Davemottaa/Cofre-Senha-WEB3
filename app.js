let encryptionKey = null;
let lastSyncedData = "";
let visiblePasswordTimeout = null;
let currentUser = null;
let isOnCorrectNetwork = false;
let currentNetworkChainId = null;

// Configuração de redes suportadas
const SUPPORTED_NETWORKS = {
    11155111: { // Sepolia
        name: 'Sepolia Testnet',
        contractAddress: '0x95D234085B83Ec63487CF37Df6DF5Fae0B6D4be6',
        rpcUrl: 'https://sepolia.infura.io/v3/cbb0240f1d5d4615a57103b1378e6871'
    }
};

// FUNÇÃO CRÍTICA: Obter o endereço do contrato para a rede atual
function getContractAddressForCurrentNetwork() {
    // Validação extra: verificar se chainId é válido
    if (!currentNetworkChainId) {
        console.error('❌ ERRO: currentNetworkChainId é null!');
        console.error('   Isto significa que validateNetwork() não foi executada com sucesso.');
        return null;
    }
    
    // Validar tipo de dados
    if (typeof currentNetworkChainId !== 'number') {
        console.error(`❌ ERRO: currentNetworkChainId não é um número! Tipo: ${typeof currentNetworkChainId}, Valor: ${currentNetworkChainId}`);
        return null;
    }
    
    const network = SUPPORTED_NETWORKS[currentNetworkChainId];
    if (!network) {
        console.error(`❌ ERRO: Rede ${currentNetworkChainId} não suportada!`);
        console.error(`   Redes suportadas: ${Object.keys(SUPPORTED_NETWORKS).join(', ')}`);
        return null;
    }
    
    // Validar endereço do contrato
    const contractAddr = network.contractAddress;
    if (!contractAddr || contractAddr === '0x...' || contractAddr.length < 42) {
        console.error(`❌ ERRO: Endereço do contrato inválido: ${contractAddr}`);
        console.error(`   Para a rede ${network.name}`);
        return null;
    }
    
    console.log(`✅ Usando contrato da ${network.name}: ${contractAddr}`);
    return contractAddr;
}

const abi = [
    { "inputs": [{ "internalType": "string", "name": "_novosDados", "type": "string" }], "name": "salvarCofre", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "recuperarCofre", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

// --- UTILITÁRIOS ---
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showError(title, message) {
    console.error(`[${title}] ${message}`);
    showProcessing(title, message);
    setTimeout(hideProcessing, 3000);
}

// Validar dados de entrada
function validatePasswordEntry(site, user, pass) {
    if (!site?.trim() || site.length > 100) {
        showError("❌ Nome do Site Inválido", "Por favor, escreva o nome do site (máximo 100 caracteres).\nExemplo: Facebook, Gmail, Amazon, etc.");
        return false;
    }
    if (pass.length < 4 || pass.length > 128) {
        showError("❌ Senha Inválida", "A senha deve ter entre 4 e 128 caracteres. Escreva uma senha mais longa.");
        return false;
    }
    if (user && user.length > 255) {
        showError("❌ Utilizador Muito Longo", "O nome de utilizador ou email é muito longo (máximo 255 caracteres).");
        return false;
    }
    return true;
}

// Validar rede da carteira
async function validateNetwork() {
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        await provider.detectNetwork(); // Forçar atualização de cache
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        
        console.log(`📊 Rede detectada: ${network.name} (ChainId: ${chainId})`);
        
        if (!SUPPORTED_NETWORKS[chainId]) {
            console.error(`❌ ChainId ${chainId} não está em SUPPORTED_NETWORKS!`);
            showError("❌ Rede Errada", `ATENÇÃO: Está na rede ${network.name}.\n\nDeve trocar para SEPOLIA na MetaMask!\n\n1. Clique no ícone da MetaMask\n2. Selecione "Redes"\n3. Escolha "Sepolia Testnet"`);
            isOnCorrectNetwork = false;
            currentNetworkChainId = null; // Limpar chainId se rede errada
            return false;
        }
        
        // ✅ Guardar o chainId válido
        currentNetworkChainId = chainId;
        isOnCorrectNetwork = true;
        console.log(`✅ Rede VALIDADA: ${SUPPORTED_NETWORKS[chainId].name} (ChainId: ${chainId})`);
        console.log(`✅ currentNetworkChainId foi setado para: ${currentNetworkChainId}`);
        return true;
    } catch (e) {
        console.error('❌ Erro ao validar rede:', e);
        showError("❌ Erro na Rede", "Não conseguimos verificar a rede. Tente novamente.");
        currentNetworkChainId = null;
        return false;
    }
}

// Listener para mudanças de rede
if (window.ethereum) {
    window.ethereum.on('chainChanged', () => {
        console.log('🔄 Rede foi alterada! Recarregando...');
        location.reload();
    });
}

// Limpeza segura de dados sensíveis
function secureClear() {
    encryptionKey = null;
    currentUser = null;
    lastSyncedData = "";
    currentNetworkChainId = null; // 🔴 Também limpar chainId
    
    // Remover dados criptografados do localStorage
    localStorage.removeItem('my_passwords');
    localStorage.removeItem('last_synced_data');
    localStorage.removeItem('last_sync_hash');
    
    // Limpar inputs
    document.getElementById('siteName').value = "";
    document.getElementById('siteUser').value = "";
    document.getElementById('sitePass').value = "";
    document.getElementById('passwordList').innerHTML = "";
    document.getElementById('btn-copy-generated').style.display = 'none';
    
    clearTimeout(visiblePasswordTimeout);
}

function getLocalStorageEncrypted(key) {
    try {
        if (!encryptionKey) {
            console.error('Chave de encriptação não disponível');
            return null;
        }
        const encrypted = localStorage.getItem(key);
        if (!encrypted) return null;
        
        const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey);
        if (!decrypted || decrypted.length === 0) {
            console.error('Falha ao desencriptar - dados corrompidos');
            return null;
        }
        
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
        return JSON.parse(plaintext);
    } catch (e) {
        console.error('Erro ao desencriptar localStorage:', e);
        return null;
    }
}

function setLocalStorageEncrypted(key, data) {
    try {
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey).toString();
        localStorage.setItem(key, encrypted);
    } catch (e) {
        console.error('Erro ao encriptar localStorage:', e);
        throw e;
    }
}

function calculateHash(data) {
    return CryptoJS.SHA256(JSON.stringify(data)).toString();
}

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// --- MODAIS ---
function showProcessing(title, message) {
    document.getElementById('status-title').innerText = title;
    document.getElementById('status-msg').innerText = message;
    document.getElementById('status-modal').style.display = 'flex';
}
function hideProcessing() { document.getElementById('status-modal').style.display = 'none'; }
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- CRIPTO ---
function encryptFull(data) { 
    return CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey).toString(); 
}
function decryptFull(cipher) {
    try {
        if (!cipher || typeof cipher !== 'string' || cipher.length < 20) {
            console.error('Cifra inválida ou corrompida');
            return null;
        }
        if (!encryptionKey) {
            console.error('Chave de encriptação não disponível');
            return null;
        }
        
        const bytes = CryptoJS.AES.decrypt(cipher, encryptionKey);
        if (!bytes || bytes.length === 0) {
            console.error('Falha ao desencriptar - dados vazios');
            return null;
        }
        
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(plaintext);
    } catch (e) { 
        console.error('Erro ao desencriptar dados:', e);
        return null; 
    }
}

// --- WEB3 ---
async function connectWallet() {
    if (!window.ethereum) {
        showError("❌ MetaMask Não Encontrada", "Você precisa instalar a extensão MetaMask no navegador.");
        return;
    }
    try {
        showProcessing("🔐 A Conectar à Carteira", "Por favor, confirme na janela da MetaMask.");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        if (!await validateNetwork()) {
            hideProcessing();
            return;
        }
        
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        currentUser = await signer.getAddress();
        
        // MENSAGEM FIXA: Essencial para que a chave de encriptação seja sempre a mesma
        const message = "Aceder ao Cofre Seguro: Confirme a sua identidade para desencriptar os seus dados.";
        
        showProcessing("✍️ A Assinar Mensagem", "Confirme a assinatura na MetaMask.");
        const sig = await signer.signMessage(message);
        
        // A chave agora é gerada de forma determinística baseada na assinatura fixa
        encryptionKey = ethers.utils.keccak256(sig);
        
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('user-address').innerText = `${currentUser.substring(0, 6)}...${currentUser.substring(38)} (Sepolia)`;
        
        await downloadFromBlockchain();
    } catch (e) { 
        showError("❌ Erro ao Conectar", "Certifique-se de que confirmou a assinatura na MetaMask.");
    }
}
function logout() {
    showModal('logout-modal');
    document.getElementById('confirm-logout-btn').onclick = () => {
        closeModal('logout-modal');
        
        // Limpeza segura de todos os dados sensíveis
        secureClear();
        
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
        isOnCorrectNetwork = false;
        
        showProcessing("Desconectado", "Até à próxima!");
        setTimeout(hideProcessing, 1500);
    };
}

async function saveAndSync() {
    const site = document.getElementById('siteName').value.trim();
    const user = document.getElementById('siteUser').value.trim();
    const pass = document.getElementById('sitePass').value;

    if (!validatePasswordEntry(site, user, pass)) return;
    if (!isOnCorrectNetwork) {
        showError("❌ Rede Errada", "Mude para Sepolia na MetaMask.");
        return;
    }

    try {
        showProcessing("💾 A Guardar a Senha", "Encriptando dados...");
        let passwords = getLocalStorageEncrypted('my_passwords') || [];
        passwords.push({ id: Date.now(), site, user, pass });
        
        const enc = encryptFull(passwords);

        // Alerta de custo se os dados ficarem muito grandes
        if (enc.length > 5000) {
            console.warn("Atenção: O cofre está a ficar grande. O custo de Gas será elevado.");
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddr = getContractAddressForCurrentNetwork();
        
        if (!contractAddr) return;
        
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        
        // O envio da transação para a rede
        const tx = await contract.salvarCofre(enc);
        
        showProcessing("⏳ Confirmando na Blockchain", "Aguardando confirmação da rede...");
        await tx.wait();

        setLocalStorageEncrypted('my_passwords', passwords);
        lastSyncedData = enc;
        localStorage.setItem('last_sync_hash', calculateHash(passwords));
        renderPasswords();
        
        showProcessing("✅ Sucesso!", "Senha guardada na Blockchain!");
        setTimeout(hideProcessing, 2000);
        
        // Limpar campos
        document.getElementById('siteName').value = "";
        document.getElementById('siteUser').value = "";
        document.getElementById('sitePass').value = "";
    } catch (e) { 
        showError("❌ Erro ao Guardar", e.message || "Falha na transação.");
    }
}

async function downloadFromBlockchain() {
    try {
        showProcessing("📥 A Carregar Senhas", "Estamos a procurar as suas senhas guardadas na Internet. Por favor, aguarde...");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // 🔴 FIX: Usar endereço DINÂMICO baseado na rede atual
        const contractAddr = getContractAddressForCurrentNetwork();
        if (!contractAddr) {
            console.error('❌ ERRO: getContractAddressForCurrentNetwork() retornou null!');
            showError("❌ Erro de Configuração", "Não conseguimos obter o endereço do contrato. Recarregue a página.");
            return;
        }
        
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            console.error(`❌ ERRO: Endereço inválido: ${contractAddr}`);
            showError("❌ Erro de Configuração", "Endereço do contrato inválido.");
            return;
        }
        
        console.log(`📥 A carregar senhas do contrato: ${contractAddr}`);
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const data = await contract.recuperarCofre();
        if(data && data.length > 20) {
            const dec = decryptFull(data);
            if (dec) {
                setLocalStorageEncrypted('my_passwords', dec);
                lastSyncedData = data;
                localStorage.setItem('last_sync_hash', calculateHash(dec));
                console.log(`✅ ${dec.length} senhas carregadas com sucesso!`);
            } else {
                showError("⚠️ Dados Corrompidos", "Houve um problema ao ler os dados. Tente novamente mais tarde.");
                return;
            }
        } else {
            console.log('ℹ️ Nenhuma senha guardada ainda.');
            showProcessing("✅ Tudo Pronto!", "Nenhuma senha guardada ainda. Pode começar a adicionar senhas agora.");
            setTimeout(hideProcessing, 2000);
        }
        renderPasswords();
        if(data && data.length > 20) hideProcessing();
    } catch (e) { 
        console.error('❌ ERRO ao carregar:', e);
        showError("❌ Erro ao Carregar", "Não conseguimos aceder às senhas guardadas. Verifique a sua ligação à Internet e tente novamente.");
    }
}

// --- RENDERIZAR LISTA ---
function renderPasswords(openId = null) {
    const list = document.getElementById('passwordList');
    const passwords = getLocalStorageEncrypted('my_passwords') || [];
    const statusText = document.getElementById('sync-status-text');

    list.innerHTML = '';
    
    const currentHash = calculateHash(passwords);
    const lastHash = localStorage.getItem('last_sync_hash') || '';
    
    statusText.innerHTML = (lastHash && currentHash === lastHash) 
        ? "<span style='color:var(--success)'>✅ Todas as suas senhas estão guardadas com segurança na Internet</span>" 
        : "<span style='color:var(--warning)'>⚠️ Tem senhas novas que ainda não foram guardadas. Clique no botão \"Guardar\" para as proteger.</span>";

    passwords.forEach(p => {
        const isOpen = p.id === openId;
        const card = document.createElement('div');
        card.className = 'pass-card';
        
        const passDisplay = document.createElement('div');
        passDisplay.className = 'pass-display';
        passDisplay.textContent = isOpen ? p.pass : '••••••••';
        
        const passInfo = document.createElement('div');
        passInfo.className = 'pass-info';
        passInfo.innerHTML = `<b>${sanitizeHTML(p.site)}</b><br><small>${sanitizeHTML(p.user || 'Sem utilizador')}</small>`;
        
        card.appendChild(passInfo);
        card.appendChild(passDisplay);
        
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group-card';
        
        const btnVer = document.createElement('button');
        btnVer.className = 'btn-card btn-ver';
        btnVer.innerHTML = '<i class="fas fa-eye"></i> Ver';
        btnVer.onclick = () => askToView(p.id);
        btnGroup.appendChild(btnVer);
        
        if (isOpen) {
            const btnCopiar = document.createElement('button');
            btnCopiar.className = 'btn-card btn-copiar';
            btnCopiar.innerHTML = '<i class="fas fa-copy"></i> Copiar';
            btnCopiar.onclick = () => copyToClipboard(p.pass);
            btnGroup.appendChild(btnCopiar);
        }
        
        const btnApagar = document.createElement('button');
        btnApagar.className = 'btn-card btn-apagar';
        btnApagar.innerHTML = '<i class="fas fa-trash"></i> Apagar';
        btnApagar.onclick = () => askToDelete(p.id);
        btnGroup.appendChild(btnApagar);
        
        card.appendChild(btnGroup);
        list.appendChild(card);
    });
    
    // Auto-limpar senha visível após 30 segundos
    if (openId) {
        clearTimeout(visiblePasswordTimeout);
        visiblePasswordTimeout = setTimeout(() => {
            renderPasswords(null);
            showProcessing("Aviso", "Senha ocultada por segurança.");
            setTimeout(hideProcessing, 1500);
        }, 30000);
    }
}

function askToView(id) {
    showModal('security-modal');
    document.getElementById('confirm-view-btn').onclick = () => {
        closeModal('security-modal');
        renderPasswords(id);
    };
}

function copyToClipboard(txt) {
    navigator.clipboard.writeText(txt).then(() => {
        showProcessing("✓ Copiado!", "A senha foi copiada para a memória. Pode agora colar em qualquer lugar (Ctrl+V).");
        setTimeout(hideProcessing, 2000);
    }).catch(() => {
        showError("❌ Erro na Cópia", "Não conseguimos copiar a senha. Tente novamente.");
    });
}

function askToDelete(id) {
    showModal('delete-modal');
    document.getElementById('confirm-delete-btn').onclick = async () => {
        closeModal('delete-modal');
        await deleteAndSync(id);
    };
}

async function deleteAndSync(id) {
    showProcessing("⏳ A Eliminar a Senha", "Estamos a remover a senha com segurança. Por favor, aguarde...");
    try {
        let passwords = getLocalStorageEncrypted('my_passwords') || [];
        passwords = passwords.filter(p => p.id !== id);
        const enc = encryptFull(passwords);

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // 🔴 FIX: Usar endereço DINÂMICO baseado na rede atual
        const contractAddr = getContractAddressForCurrentNetwork();
        if (!contractAddr) {
            console.error('❌ ERRO: getContractAddressForCurrentNetwork() retornou null!');
            showError("❌ Erro de Configuração", "Não conseguimos obter o endereço do contrato. Recarregue a página.");
            return;
        }
        
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            console.error(`❌ ERRO: Endereço inválido: ${contractAddr}`);
            showError("❌ Erro de Configuração", "Endereço do contrato inválido.");
            return;
        }
        
        console.log(`🗑️ A eliminar senha do contrato: ${contractAddr}`);
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const tx = await contract.salvarCofre(enc);
        await tx.wait();
        
        setLocalStorageEncrypted('my_passwords', passwords);
        lastSyncedData = enc;
        localStorage.setItem('last_sync_hash', calculateHash(passwords));
        renderPasswords();
        
        showProcessing("✅ Eliminada!", "A senha foi removida de forma permanente.");
        setTimeout(hideProcessing, 1500);
    } catch (e) { 
        console.error('❌ ERRO ao eliminar:', e);
        showError("❌ Erro ao Eliminar", "Não conseguimos remover a senha. Tente novamente mais tarde.");
    }
}

function showPasswordGenerator() {
    showModal('generator-modal');
}

function generateRandomPass() {
    const length = parseInt(document.getElementById('pass-length').value) || 14;
    const useLower = document.getElementById('pass-lower').checked;
    const useUpper = document.getElementById('pass-upper').checked;
    const useNumbers = document.getElementById('pass-numbers').checked;
    const useSymbols = document.getElementById('pass-symbols').checked;

    let chars = "";
    if (useLower) chars += "abcdefghjkmnpqrstuvwxyz";
    if (useUpper) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (useNumbers) chars += "23456789";
    if (useSymbols) chars += "!@#$%&*";

    if (!chars) {
        showError("❌ Nenhuma Opção", "Selecione pelo menos uma opção (letras, números ou símbolos).");
        return;
    }

    let newPass = "";
    for (let i = 0; i < length; i++) {
        newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    document.getElementById('sitePass').value = newPass;
    document.getElementById('btn-copy-generated').style.display = 'flex';
    closeModal('generator-modal');
    
    const strength = length > 16 ? 'Muito Forte' : length > 12 ? 'Forte' : 'Segura';
    showProcessing("✨ Senha Gerada!", `Pronta a usar! Força: ${strength} (${length} caracteres)`);
    setTimeout(hideProcessing, 2000);
}

function copyGeneratedPass() {
    const passValue = document.getElementById('sitePass').value;
    if (passValue) {
        navigator.clipboard.writeText(passValue).then(() => {
            showProcessing("✓ Copiado!", "A senha foi copiada com sucesso.");
            setTimeout(hideProcessing, 1500);
        }).catch(() => {
            showError("❌ Erro", "Não conseguimos copiar a senha. Tente novamente.");
        });
    }
}

function renderPasswords(openId = null) {
    const list = document.getElementById('passwordList');
    const passwords = getLocalStorageEncrypted('my_passwords') || [];
    const statusText = document.getElementById('sync-status-text');

    list.innerHTML = '';
    
    const currentHash = calculateHash(passwords);
    const lastHash = localStorage.getItem('last_sync_hash') || '';
    
    // Feedback visual sobre o estado de sincronização com a blockchain
    if (lastHash && currentHash === lastHash) {
        statusText.innerHTML = "<span style='color:var(--success)'>● Sincronizado com a Blockchain</span>";
    } else {
        statusText.innerHTML = "<span style='color:var(--warning)'>● Alterações pendentes (Clique em Guardar)</span>";
    }

    // ... restante da lógica de criação de cards (mantida igual)
}

// Inicializa tema ao carregar
document.addEventListener('DOMContentLoaded', initTheme);