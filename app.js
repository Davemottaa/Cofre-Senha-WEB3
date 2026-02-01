
let encryptionKey = null;
let lastSyncedData = "";
let visiblePasswordTimeout = null;
let currentUser = null;
let isOnCorrectNetwork = false;
let currentNetworkChainId = null;

// Login Web2 (Google): dados guardados apenas no dispositivo (sem blockchain)
let isGoogleUser = false;
let googleUserId = null;

/**
 * Login Google (Web2): coloque aqui o Client ID do Google Cloud Console.
 * Criar em: Google Cloud Console → APIs e Serviços → Credenciais → Criar credenciais → ID de cliente OAuth 2.0 (tipo: Aplicação da Web).
 * Deixe vazio ('') para desativar o login com Google.
 */
const GOOGLE_CLIENT_ID = '707254983061-vg2dm7p37e53vct5ooleas7o9vui7kf7.apps.googleusercontent.com';

// Configuração de redes suportadas
const SUPPORTED_NETWORKS = {
    11155111: { // Sepolia
        name: 'Sepolia Testnet',
        contractAddress: '0x95D234085B83Ec63487CF37Df6DF5Fae0B6D4be6',
        rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY'
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

// Tamanho mínimo para considerar que há dados criptografados no cofre (evita "magic number")
const MIN_ENCRYPTED_LENGTH = 20;

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

/** Chave do localStorage para as senhas (Web3 = my_passwords, Web2 = por conta Google). */
function getPasswordsStorageKey() {
    return isGoogleUser && googleUserId ? 'my_passwords_google_' + googleUserId : 'my_passwords';
}

/** Chave do localStorage para o hash de sincronização. */
function getLastSyncHashKey() {
    return isGoogleUser && googleUserId ? 'last_sync_hash_google_' + googleUserId : 'last_sync_hash';
}

// Limpeza segura de dados sensíveis
function secureClear() {
    if (googleUserId) {
        localStorage.removeItem('my_passwords_google_' + googleUserId);
        localStorage.removeItem('last_sync_hash_google_' + googleUserId);
    }
    googleUserId = null;
    isGoogleUser = false;
    encryptionKey = null;
    currentUser = null;
    lastSyncedData = "";
    currentNetworkChainId = null;

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
        const storageKey = key === 'my_passwords' ? getPasswordsStorageKey() : key;
        const encrypted = localStorage.getItem(storageKey);
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
        const storageKey = key === 'my_passwords' ? getPasswordsStorageKey() : key;
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey).toString();
        localStorage.setItem(storageKey, encrypted);
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
        if (!cipher || typeof cipher !== 'string') return null;
        if (!encryptionKey) return null;
        
        const bytes = CryptoJS.AES.decrypt(cipher, encryptionKey);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);

        if (!plaintext) {
            console.error('Falha na descriptografia: Chave incorreta ou dado inválido.');
            return null;
        }
        
        return JSON.parse(plaintext);
    } catch (e) { 
        console.error('Erro crítico no JSON.parse ou Decrypt:', e);
        return null; 
    }
}

// --- WEB3 ---
/**
 * No telemóvel (Chrome/Safari), window.ethereum não é injetado. O utilizador tem de abrir
 * o site no navegador da aplicação MetaMask para poder autorizar o login.
 * Usamos o deep link link.metamask.io/dapp/<url> para abrir o site dentro da MetaMask.
 */

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

/** URL para abrir este site no navegador in-app da MetaMask (mobile). */
function getMetaMaskDappUrl() {
    const url = window.location.href;
    return 'https://link.metamask.io/dapp/' + encodeURIComponent(url);
}

/**
 * No navegador in-app da MetaMask (mobile), o provider é injetado com atraso.
 * Esperamos pelo evento 'ethereum#initialized' ou um timeout antes de redirecionar.
 * Assim, quando o utilizador já está na MetaMask, o clique em "Entrar" acaba por
 * receber o provider e mostrar o ecrã de autorização em vez de recarregar a página.
 */
function waitForEthereum(timeoutMs) {
    timeoutMs = timeoutMs || 3000;
    if (window.ethereum) return Promise.resolve(window.ethereum);
    return new Promise((resolve) => {
        let resolved = false;
        const done = (p) => {
            if (resolved) return;
            resolved = true;
            resolve(p || null);
        };
        window.addEventListener('ethereum#initialized', () => done(window.ethereum), { once: true });
        setTimeout(() => done(window.ethereum), timeoutMs);
    });
}

async function connectWallet() {
    let provider = window.ethereum;
    if (!provider && isMobile()) {
        // No telemóvel: esperar pela injeção do provider (MetaMask in-app injeta com atraso)
        showProcessing("⏳ A carregar...", "A aguardar pela MetaMask...");
        provider = await waitForEthereum(3000);
        hideProcessing();
        if (!provider) {
            // Continua sem provider: abrir o site na app MetaMask
            window.location.href = getMetaMaskDappUrl();
            return;
        }
    }
    if (!provider) {
        showError("❌ MetaMask Não Encontrada", "Por favor, instale a MetaMask.");
        return;
    }

    // Usar o provider (pode ser window.ethereum ou o que acabou de ser injetado)
    const ethereum = provider;

    try {
        showProcessing("🔐 A Conectar", "Confirme na MetaMask...");
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        
        // Valida a rede antes de qualquer coisa
        const networkOk = await validateNetwork();
        if (!networkOk) {
            hideProcessing();
            return;
        }
        
        await web3Provider.send("eth_requestAccounts", []);
        const signer = web3Provider.getSigner();
        currentUser = await signer.getAddress();
        
        // Criar chave de encriptação baseada na assinatura do utilizador.
        // IMPORTANTE: Mensagem fixa para que, ao sair e voltar, a mesma chave seja gerada
        // e os dados guardados (localStorage + blockchain) possam ser desencriptados.
        const message = "Aceder ao Cofre Seguro";
        showProcessing("✍️ A Assinar", "Isto cria a sua chave de segurança privada.");
        const sig = await signer.signMessage(message);
        
        // A chave AES é gerada a partir do hash da assinatura
        encryptionKey = ethers.utils.keccak256(sig);
        
        // Interface
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('user-address').innerText = `${currentUser.substring(0, 6)}...${currentUser.substring(38)} (Sepolia)`;
        
        await downloadFromBlockchain();
    } catch (e) { 
        console.error(e);
        showError("❌ Erro ao Conectar", "Conexão recusada ou falhou.");
    }
}

// --- LOGIN GOOGLE (WEB2) ---
/** Decodifica o payload do JWT do Google (base64url). */
function decodeGoogleJwtPayload(credential) {
    try {
        const parts = credential.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(escape(atob(base64))));
    } catch (e) {
        return null;
    }
}

function handleGoogleSignIn(response) {
    if (!response?.credential) {
        showError("❌ Erro Google", "Não foi possível obter os dados da conta Google.");
        return;
    }
    const payload = decodeGoogleJwtPayload(response.credential);
    if (!payload?.sub) {
        showError("❌ Erro Google", "Resposta da Google inválida.");
        return;
    }
    const sub = payload.sub;
    const email = payload.email || payload.sub;
    const name = payload.name || email;

    showProcessing("🔐 A entrar...", "A configurar o seu cofre.");
    try {
        // Chave de encriptação determinística por conta Google (para poder desencriptar ao voltar)
        encryptionKey = CryptoJS.SHA256("CofreSeguro_Google_" + sub).toString();
        currentUser = email;
        isGoogleUser = true;
        googleUserId = sub;

        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('user-address').innerText = name + ' (Google)';
        document.getElementById('user-address').style.fontFamily = 'inherit';

        const syncArea = document.getElementById('sync-status-area');
        const web2Notice = document.getElementById('web2-notice');
        if (syncArea) syncArea.style.display = 'none';
        if (web2Notice) web2Notice.style.display = 'block';

        renderPasswords();
        hideProcessing();
    } catch (e) {
        console.error(e);
        hideProcessing();
        showError("❌ Erro ao entrar", "Ocorreu um erro. Tente novamente.");
    }
}

/** Inicializa o botão "Entrar com Google" quando o script GIS estiver disponível. */
function initGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_ID.trim()) return;
    const container = document.getElementById('google-signin-container');
    if (!container) return;
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        setTimeout(initGoogleSignIn, 150);
        return;
    }
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID.trim(),
        callback: handleGoogleSignIn,
        auto_select: false
    });
    google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280
    });
}

function logout() {
    const modal = document.getElementById('logout-modal');
    const msg = modal ? modal.querySelector('p') : null;
    if (msg && isGoogleUser) {
        msg.innerHTML = 'Está prestes a <strong>sair do seu Cofre</strong>.<br><br>' +
            'As suas senhas ficam guardadas neste dispositivo.<br>' +
            'Pode voltar a entrar com a mesma conta Google.<br><br><strong>Deseja sair agora?</strong>';
    } else if (msg) {
        msg.innerHTML = 'Está prestes a <strong>sair do seu Cofre Seguro</strong>.<br><br>' +
            'As suas senhas continuarão guardadas com segurança na Internet.<br>' +
            'Pode voltar a entrar a qualquer momento usando a sua carteira MetaMask.<br><br><strong>Deseja sair agora?</strong>';
    }
    showModal('logout-modal');
    document.getElementById('confirm-logout-btn').onclick = () => {
        closeModal('logout-modal');
        secureClear();
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
        isOnCorrectNetwork = false;
        const syncArea = document.getElementById('sync-status-area');
        const web2Notice = document.getElementById('web2-notice');
        if (syncArea) syncArea.style.display = '';
        if (web2Notice) web2Notice.style.display = 'none';
        showProcessing("Desconectado", "Até à próxima!");
        setTimeout(hideProcessing, 1500);
    };
}

async function saveAndSync() {
    const site = document.getElementById('siteName').value.trim();
    const user = document.getElementById('siteUser').value.trim();
    const pass = document.getElementById('sitePass').value;

    // Validar entrada antes de processar
    if (!validatePasswordEntry(site, user, pass)) {
        return;
    }
    
    // Web3: verificar rede
    if (!isGoogleUser && !isOnCorrectNetwork) {
        showError("❌ Rede Errada", "Você não está na rede Sepolia!\n\nPor favor:\n1. Abra a MetaMask\n2. Mude para Sepolia Testnet\n3. Tente novamente");
        return;
    }

    try {
        showProcessing("💾 A Guardar a Senha", "Estamos a encriptar e guardar a sua senha com segurança. Por favor, aguarde...");
        let passwords = getLocalStorageEncrypted('my_passwords') || [];
        passwords.push({ id: Date.now(), site, user, pass });
        const enc = encryptFull(passwords);

        if (isGoogleUser) {
            setLocalStorageEncrypted('my_passwords', passwords);
            localStorage.setItem(getLastSyncHashKey(), calculateHash(passwords));
            renderPasswords();
            showProcessing("✅ Sucesso!", "A sua senha foi guardada neste dispositivo.");
            setTimeout(hideProcessing, 2000);
        } else {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contractAddr = getContractAddressForCurrentNetwork();
            if (!contractAddr) {
                showError("❌ Erro de Configuração", "Não conseguimos obter o endereço do contrato. Recarregue a página.");
                return;
            }
            if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
                showError("❌ Erro de Configuração", "Endereço do contrato inválido.");
                return;
            }
            const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
            const tx = await contract.salvarCofre(enc);
            showProcessing("⏳ Confirmando na Internet", "A rede está a confirmar a sua ação. Isto pode demorar alguns segundos...");
            await tx.wait();
            setLocalStorageEncrypted('my_passwords', passwords);
            lastSyncedData = enc;
            localStorage.setItem(getLastSyncHashKey(), calculateHash(passwords));
            renderPasswords();
            showProcessing("✅ Sucesso!", "A sua senha foi guardada com segurança!");
            setTimeout(hideProcessing, 2000);
        }

        document.getElementById('siteName').value = "";
        document.getElementById('siteUser').value = "";
        document.getElementById('sitePass').value = "";
        document.getElementById('btn-copy-generated').style.display = 'none';
    } catch (e) { 
        console.error('❌ ERRO COMPLETO ao guardar:', e);
        showError("❌ Erro ao Guardar", "Não conseguimos guardar a senha. Tente novamente. Erro: " + (e.message || "Falha desconhecida"));
    }
}

async function downloadFromBlockchain() {
    if (isGoogleUser) {
        renderPasswords();
        return;
    }
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
        if (data && data.length > MIN_ENCRYPTED_LENGTH) {
            const dec = decryptFull(data);
            if (dec) {
                setLocalStorageEncrypted('my_passwords', dec);
                lastSyncedData = data;
                localStorage.setItem(getLastSyncHashKey(), calculateHash(dec));
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
        if (data && data.length > MIN_ENCRYPTED_LENGTH) hideProcessing();
    } catch (e) { 
        console.error('❌ ERRO ao carregar:', e);
        hideProcessing();
        showError("❌ Erro ao Carregar", "Não conseguimos aceder às senhas guardadas. Verifique a sua ligação à Internet e tente novamente.");
    }
}

// --- RENDERIZAR LISTA ---
function renderPasswords(openId = null) {
    const list = document.getElementById('passwordList');
    const passwords = getLocalStorageEncrypted('my_passwords') || [];
    const statusText = document.getElementById('sync-status-text');

    list.innerHTML = '';

    if (passwords.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'pass-list-empty';
        emptyMsg.style.cssText = 'text-align: center; color: var(--text); opacity: 0.8; padding: 20px; font-size: 15px;';
        emptyMsg.textContent = 'Ainda não tem senhas guardadas. Use o formulário acima para adicionar a primeira.';
        list.appendChild(emptyMsg);
    }
    
    const currentHash = calculateHash(passwords);
    const lastHash = localStorage.getItem(getLastSyncHashKey()) || '';

    if (isGoogleUser) {
        statusText.innerHTML = "<span style='color:var(--success)'>✅ Conta Web2: as senhas estão guardadas apenas neste dispositivo.</span>";
    } else {
        statusText.innerHTML = (lastHash && currentHash === lastHash) 
            ? "<span style='color:var(--success)'>✅ Todas as suas senhas estão guardadas com segurança na Internet</span>" 
            : "<span style='color:var(--warning)'>⚠️ Tem senhas novas que ainda não foram guardadas. Clique no botão \"Guardar\" para as proteger.</span>";
    }

    passwords.forEach((p) => {
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

        if (isGoogleUser) {
            setLocalStorageEncrypted('my_passwords', passwords);
            localStorage.setItem(getLastSyncHashKey(), calculateHash(passwords));
            renderPasswords();
            showProcessing("✅ Eliminada!", "A senha foi removida.");
            setTimeout(hideProcessing, 1500);
            return;
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddr = getContractAddressForCurrentNetwork();
        if (!contractAddr) {
            showError("❌ Erro de Configuração", "Não conseguimos obter o endereço do contrato. Recarregue a página.");
            return;
        }
        if (!contractAddr.startsWith('0x') || contractAddr.length !== 42) {
            showError("❌ Erro de Configuração", "Endereço do contrato inválido.");
            return;
        }
        const contract = new ethers.Contract(contractAddr, abi, provider.getSigner());
        const tx = await contract.salvarCofre(enc);
        await tx.wait();
        setLocalStorageEncrypted('my_passwords', passwords);
        lastSyncedData = enc;
        localStorage.setItem(getLastSyncHashKey(), calculateHash(passwords));
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

function togglePasswordVisibility() {
    const input = document.getElementById('sitePass');
    const icon = document.getElementById('toggle-pass-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
        icon.parentElement.setAttribute('aria-label', 'Ocultar senha');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
        icon.parentElement.setAttribute('aria-label', 'Mostrar senha');
    }
}

// Inicializa tema ao carregar
document.addEventListener('DOMContentLoaded', initTheme);
// --- INICIALIZAÇÃO E EVENTOS ---

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // No telemóvel: esperar um pouco pela injeção do provider (MetaMask in-app injeta com atraso).
    const mobileHint = document.getElementById('mobile-metamask-hint');
    const mobileLink = document.getElementById('mobile-metamask-link');
    if (mobileHint && mobileLink && isMobile()) {
        waitForEthereum(2500).then((p) => {
            if (!p) {
                mobileHint.style.display = 'block';
                mobileLink.href = getMetaMaskDappUrl();
            }
        });
    }

    // Inicializar botão Google quando o script GIS estiver carregado
    initGoogleSignIn();

    const btnConnect = document.getElementById('btnConnect');
    if (btnConnect) btnConnect.addEventListener('click', connectWallet);

    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.addEventListener('click', saveAndSync);

    const btnLogout = document.getElementById('logout-btn');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    const btnRefresh = document.querySelector('.btn-blockchain-recover');
    if (btnRefresh) btnRefresh.addEventListener('click', downloadFromBlockchain);

    const btnTogglePass = document.getElementById('toggle-pass-visibility');
    if (btnTogglePass) btnTogglePass.addEventListener('click', togglePasswordVisibility);
});

// Tornar funções acessíveis para chamadas dinâmicas (como no renderPasswords)
window.askToView = askToView;
window.askToDelete = askToDelete;
window.copyToClipboard = copyToClipboard;