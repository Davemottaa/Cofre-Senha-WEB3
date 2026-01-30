# 🔐 Cofre Web3 Seguro

Um gestor de senhas descentralizado e seguro baseado em Ethereum, permitindo armazenar e sincronizar suas senhas na blockchain de forma criptografada.

## ✨ Features

- 🔒 **Encriptação AES-256**: Todas as senhas são encriptadas localmente antes de serem enviadas para o blockchain
- 🌐 **Web3 Integrado**: Autenticação via MetaMask com assinatura de mensagem
- ⛓️ **Blockchain Ethereum**: Armazenamento descentralizado e imutável das senhas encriptadas
- 🎨 **Dark Mode**: Interface otimizada com tema escuro/claro
- 👴 **Acessibilidade Sênior**: Interface especialmente desenhada para utilizadores idosos
  - Botões e texto aumentados
  - Alto contraste
  - Confirmação modal para ações sensíveis
- 🔄 **Sincronização Automática**: Hash SHA-256 para detectar mudanças
- 🛡️ **Segurança em Camadas**: Sanitização XSS, encriptação localStorage, timeout automático
- 📱 **Responsivo**: Funciona em desktop e mobile

## 🚀 Começar

### Requisitos

- **Navegador Moderno**: Chrome, Firefox, Edge ou Safari
- **MetaMask**: [Instalar MetaMask](https://metamask.io/)
- **Ethereum**: Conectado a uma rede Ethereum (Mainnet ou testnet)

### Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/cofre-web3-seguro.git
   cd cofre-web3-seguro

2. **Abra no navegador**
  # Abra diretamente no navegador (sem servidor necessário)
  open index.html

  # Ou use um servidor local
  python -m http.server 8000
  # Então acesse http://localhost:8000

3. **Configure o MetaMask**
  Instale a extensão MetaMask
  Crie ou importe uma carteira
  Certifique-se de estar na rede Ethereum correta


📖 Como Usar
1. Conectar ao Cofre
Clique no botão "Entrar no meu Cofre"
Autorize o acesso na extensão MetaMask
Assine a mensagem de autenticação
O app sincronizará automaticamente suas senhas guardadas
2. Adicionar uma Nova Senha
Preencha os campos:

Nome do Site: Ex: Facebook, Gmail, etc.
Utilizador/Email: Sua conta de utilizador
Senha: Digite ou gere uma
Gerar Senha Forte (opcional):

Clique em "Criar"
Customize as opções:
Comprimento (8-32 caracteres)
Letras minúsculas/MAIÚSCULAS
Números
Símbolos
Clique em "Gerar"
Clique em "Guardar na Internet"

Confirme a transação no MetaMask

Aguarde a confirmação na blockchain

3. Ver uma Senha
Localize a senha na lista
Clique em "Ver"
Confirme no modal de segurança
A senha será visível por 30 segundos (auto-oculta por segurança)
4. Copiar Senha
Clique em "Ver" para mostrar a senha
Clique em "Copiar"
A senha foi copiada para o clipboard
5. Apagar uma Senha
Clique em "Apagar"
Confirme no modal
A senha será removida da blockchain
6. Desconectar
Clique no ícone logout (canto superior direito)
Confirme a desconexão
Suas senhas permanecerão guardadas na blockchain


┌─────────────────────────────────────────┐
│        Frontend (App Web3)              │
│  ┌─────────────────────────────────┐   │
│  │     Interface Utilizador        │   │
│  │  (HTML/CSS + Dark Mode)         │   │
│  └─────────────────────────────────┘   │
│              │                         │
│              ▼                         │
│  ┌─────────────────────────────────┐   │
│  │   Camada de Lógica (app.js)    │   │
│  │  - Encriptação AES-256         │   │
│  │  - Validação de dados          │   │
│  │  - Tratamento de erros         │   │
│  └─────────────────────────────────┘   │
│              │                         │
│              ▼                         │
│  ┌─────────────────────────────────┐   │
│  │   Web3 Integration (ethers.js) │   │
│  │  - MetaMask connection         │   │
│  │  - Contract interaction        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Blockchain Ethereum                   │
│  ┌─────────────────────────────────┐   │
│  │  Smart Contract (CofreSenhas)   │   │
│  │  Endereço: 0x95D234085B83Ec63  │   │
│  │                                 │   │
│  │  Funções:                       │   │
│  │  - salvarCofre(dados)          │   │
│  │  - recuperarCofre()            │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

Fluxo de Dados
Autenticação:

User clica em "Entrar"
MetaMask pede autorização
User assina mensagem: "Aceder ao Cofre Seguro"
Assinatura é processada com keccak256 → chave de encriptação
Guardar Senha:

Dados são encriptados com AES-256 (chave: signature hash)
Enviados para smart contract
Contrato armazena no mapping: address → encrypted_data
Hash SHA-256 é guardado localmente para sincronização
Recuperar Senhas:

App lê dados criptografados do blockchain
Desencripta com a mesma chave
Compara hash para detectar mudanças
Renderiza lista de senhas

🔐 Segurança
Encriptação em Camadas
Camada	Método	Chave
1️⃣	AES-256	keccak256(assinatura MetaMask)
2️⃣	LocalStorage	Também encriptado com AES-256
3️⃣	Blockchain	Imutável e descentralizado
Medidas de Segurança
✅ Sem armazenamento em plaintext: Senhas sempre encriptadas
✅ Sanitização XSS: Proteção contra injeção de código
✅ Auto-limpeza: Senhas visíveis por apenas 30 segundos
✅ Timeout automático: Logout automático se necessário
✅ Confirmação modal: Ações sensíveis requerem confirmação dupla
✅ Validação de entrada: Todos os inputs são sanitizados
⚠️ Limitações Conhecidas
A segurança depende da segurança da sua carteira MetaMask
Se a assinatura for comprometida, as senhas podem ser decodificadas
Não há backup automático - recomenda-se manter backup seguro
A blockchain é imutável - senhas apagadas não podem ser recuperadas
📊 Dependências
Externas (CDN)
CryptoJS 4.1.1: Encriptação AES-256 e SHA-256
ethers.js 5.7.2: Integração Web3/Ethereum
Font Awesome 6.4.0: Ícones
Navegador
LocalStorage: Armazenamento local encriptado
MetaMask Extension: Autenticação Web3
window.ethereum: API injetada pelo MetaMask

🛠️ Estrutura do Projeto
.
├── [index.html](http://_vscodecontentref_/0)           # Página principal com modais
├── [app.js](http://_vscodecontentref_/1)              # Lógica da aplicação
├── [style.css](http://_vscodecontentref_/2)           # Estilos com dark mode
├── [contract.sol](http://_vscodecontentref_/3)        # Smart contract Solidity
├── README.md           # Este arquivo
├── LICENSE             # MIT License
└── .gitignore          # Arquivos ignorados pelo git

🔧 Configuração Avançada
Mudar Network/Contrato
Edite app.js:

const contractAddress = "0xSEU_ENDERECO_AQUI";
const abi = [...]; // ABI do seu contrato

Suportar Múltiplas Networks
const networks = {
  1: { name: 'Mainnet', address: '0x...' },
  11155111: { name: 'Sepolia', address: '0x...' },
  8453: { name: 'Base', address: '0x...' }
};

🐛 Troubleshooting
"Instala a MetaMask!"
✅ Instale MetaMask
✅ Ative a extensão
✅ Recarregue a página
"Falha na autenticação"
✅ Certifique-se de que assinou a mensagem
✅ Verifique se está conectado à carteira
✅ Tente desconectar e conectar novamente
"Falha ao sincronizar com blockchain"
✅ Verificar conexão de internet
✅ Verificar se está na rede correta (verificar chain ID)
✅ Verificar se o contrato existe nessa rede
✅ Certificar-se de que tem saldo de gas
"A senha não aparece"
✅ Verifique se clicou em "Atualizar tudo agora"
✅ Verifique se está conectado à mesma carteira
✅ Verifique o console do navegador para erros
📈 Roadmap
 Exportar/Importar senhas (JSON)
 Autofill em navegador
 Aplicação mobile (React Native)
 Suporte a múltiplas redes (Polygon, Base, etc.)
 2FA (autenticação dupla)
 Partilha segura de senhas
 Histórico de alterações
 Integração IPFS para backup descentralizado
🤝 Contribuir
Contribuições são bem-vindas! Por favor:

Faça um fork do projeto
Crie uma branch para sua feature (git checkout -b feature/AmazingFeature)
Commit suas mudanças (git commit -m 'Add some AmazingFeature')
Push para a branch (git push origin feature/AmazingFeature)
Abra um Pull Request
Veja CONTRIBUTING.md para mais detalhes.

🔒 Segurança
Se descobrir uma vulnerabilidade, não abra uma issue pública. Por favor, email para seguranca@seu-email.com

Veja SECURITY.md para mais detalhes.

📄 Licença
Este projeto está licenciado sob a MIT License - veja LICENSE para detalhes.

👨‍💻 Autor
Seu Nome

GitHub: @seu-usuario
Email: seu-email@example.com
🙏 Agradecimentos
MetaMask - Carteira Web3
ethers.js - Web3 library
CryptoJS - Encriptação
Ethereum - Blockchain
⭐ Suporte
Se este projeto foi útil, por favor deixe uma ⭐ no GitHub!

Desenvolvido com ❤️ e segurança em mente.

Última atualização: Janeiro 2026