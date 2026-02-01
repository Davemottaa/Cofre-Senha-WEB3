# 🔐 Cofre Web3 Seguro

Um gestor de senhas descentralizado e seguro baseado em Ethereum, que permite armazenar e sincronizar as suas senhas na blockchain de forma criptografada.

## ✨ Funcionalidades

- 🔐 **Dois tipos de login**: **Web3** (MetaMask) e **Web2** (Google)
- 🔒 **Encriptação AES-256**: Todas as senhas são encriptadas localmente
- 🌐 **Web3**: MetaMask + blockchain Sepolia para guardar senhas na Internet
- 📧 **Web2**: Login com Google; senhas guardadas apenas no dispositivo (localStorage)
- 🎨 **Dark mode**: Interface com tema escuro/claro
- 👴 **Acessibilidade**: Botões e texto ampliados, alto contraste, confirmação em modais para ações sensíveis
- 🔄 **Sincronização**: Hash SHA-256 para detectar alterações e estado “guardado na Internet”
- 🛡️ **Segurança**: Sanitização XSS, encriptação no localStorage, campo de senha mascarado, auto-ocultação após 30 s
- 📱 **Responsivo**: Funciona em desktop e mobile

## 🚀 Começar

### Requisitos

- **Navegador moderno**: Chrome, Firefox, Edge ou Safari
- **MetaMask**: [Instalar MetaMask](https://metamask.io/)
- **Rede Sepolia**: O app está configurado para Sepolia Testnet

### Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/cofre-web3-seguro.git
   cd cofre-web3-seguro
   ```

2. **Abra no navegador**
   ```bash
   # Abra diretamente o index.html ou use um servidor local:
   python -m http.server 8000
   # Aceda a http://localhost:8000
   ```

3. **Configure o MetaMask** (para login Web3)
   - Instale a extensão MetaMask
   - Crie ou importe uma carteira
   - Mude para a rede **Sepolia Testnet**

4. **Configure o Google** (opcional, para login Web2)
   - Crie um projeto em [Google Cloud Console](https://console.cloud.google.com/)
   - Ative a API "Google Identity Services"
   - Crie credenciais **OAuth 2.0 – ID de cliente** (tipo: Aplicação da Web)
   - Em **app.js**, defina `GOOGLE_CLIENT_ID` com o seu Client ID

## 📖 Como usar

1. **Conectar ao cofre**
   - **Web3:** Clique em "Entrar com MetaMask (Web3)", autorize na MetaMask e assine a mensagem. As senhas são carregadas da blockchain.
   - **Web2:** Clique no botão "Continuar com o Google". As senhas ficam apenas neste dispositivo.

2. **Adicionar senha**  
   Preencha o nome do site, utilizador/email (opcional) e senha. Use "Criar" para gerar uma senha forte. Clique em "Guardar Senha". Em Web3 confirme na MetaMask; em Web2 a senha é guardada só no dispositivo.

3. **Ver / copiar senha**  
   Clique em "Ver", confirme no modal. A senha fica visível 30 segundos (auto-oculta). Use "Copiar" para colar noutro sítio.

4. **Apagar senha**  
   Clique em "Apagar", confirme no modal. Em Web3 a senha é removida da blockchain; em Web2 é removida do dispositivo.

5. **Desconectar**  
   Use o botão de logout. Em Web3 as senhas ficam na blockchain; em Web2 ficam no dispositivo. Pode voltar a entrar com a mesma conta (MetaMask ou Google).

## 🛠️ Estrutura do projeto

```
.
├── index.html      # Página principal e modais
├── app.js          # Lógica da aplicação (Web3, cripto, UI)
├── style.css       # Estilos e dark mode
├── contract.sol     # Smart contract Solidity
├── README.md        # Este ficheiro
├── ANALISE-MELHORIAS.md  # Análise de melhorias e ajustes
└── .gitignore
```

A integração Web3 e a encriptação estão concentradas em **app.js** (ethers.js + CryptoJS via CDN).

## 📊 Dependências (CDN)

| Biblioteca    | Versão | Uso                    |
|---------------|--------|------------------------|
| CryptoJS      | 4.1.1  | AES-256 e SHA-256      |
| ethers.js     | 5.7.2  | MetaMask e contrato    |
| Font Awesome  | 6.4.0  | Ícones                 |

O navegador usa **localStorage** (dados encriptados) e a **API window.ethereum** (MetaMask).

## 🔐 Segurança

- **Encriptação**: AES-256 com chave derivada de `keccak256(assinatura)` da mensagem "Aceder ao Cofre Seguro"
- **LocalStorage**: Conteúdo encriptado com a mesma chave
- **Blockchain**: Contrato guarda apenas o blob encriptado por endereço
- **Medidas**: Sem plaintext, sanitização XSS, confirmação em modais, campo de senha mascarado

**Limitações**: A segurança depende da carteira MetaMask; se a assinatura for comprometida, as senhas podem ser desbloqueadas. Não há backup automático; a blockchain é imutável (eliminações são permanentes).

## 🔧 Configuração

Para mudar de rede ou contrato, edite em **app.js** o objeto `SUPPORTED_NETWORKS` e o ABI. O projeto já suporta múltiplas redes por `chainId` (ex.: Sepolia 11155111).

## 🐛 Resolução de problemas

- **"MetaMask não encontrada"** → Instale e ative a extensão; recarregue a página.
- **"Rede errada"** → Mude para Sepolia Testnet na MetaMask.
- **Falha ao carregar/guardar** → Verifique Internet, rede correta, saldo de gas e se o contrato está implantado nessa rede.
- **Senhas não aparecem ao voltar** → Entre com a mesma carteira e assine a mesma mensagem; a chave de encriptação é determinística.

## 📄 Licença

MIT License. Desenvolvido com foco em segurança.

Última atualização: Fevereiro 2026
