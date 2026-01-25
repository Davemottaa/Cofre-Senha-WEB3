🔐 Cofre Web3 Seguro<p align="center"><img src="https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Ethereum" /><img src="https://img.shields.io/badge/MetaMask-F6851B?style=for-the-badge&logo=metamask&logoColor=white" alt="MetaMask" /><img src="https://img.shields.io/badge/AES--256-0095D9?style=for-the-badge" alt="AES-256" /><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></p>Gerenciador de senhas descentralizado focado em acessibilidade e soberania de dados. O Cofre Web3 elimina o ponto único de falha dos gerenciadores de nuvem tradicionais, utilizando a rede Ethereum como camada de persistência imutável e criptografada.📋 ÍndiceDiferenciais de AcessibilidadeArquitetura de SegurançaStack TécnicaConfiguração do AmbienteSmart ContractRoadmap👴 Diferenciais de Acessibilidade (Senior-First)Diferente de outros dApps, este projeto foi desenhado para ser inclusivo:UI Adaptativa: Contrastes validados pelo guia WCAG.Cognição Assistida: Modais de confirmação em linguagem clara para evitar transações acidentais.Feedback Visual: Indicadores de estado de rede e transação simplificados.🛡️ Arquitetura de SegurançaO projeto utiliza uma abordagem de Zero-Knowledge Storage. Nem mesmo o dono do contrato pode ler suas senhas.O Fluxo de CriptografiaDerivação de Chave: A chave mestra nunca é digitada. Ela é o resultado do keccak256 da assinatura digital do usuário via MetaMask.Encryption on-the-fly: O texto plano é convertido em $AES-256$ Ciphertext antes de sair da memória do navegador.On-Chain Storage: Apenas o bytes32 resultante é enviado para o contrato inteligente.Snippet de códigograph LR
    A[Senha Plaintext] --> B{Assinatura MetaMask}
    B --> C[AES-256 Encryption]
    C --> D[Ethereum Blockchain]
    D --> E[Imutabilidade]
💻 Stack TécnicaCamadaTecnologiaFrontendHTML5, CSS3 (Modern Variables), JS VanillaWeb3Ethers.js v5.7CriptografiaCryptoJS (AES, SHA-256)Smart ContractsSolidity 0.8.xBlockchainEthereum (Mainnet/Testnets)🚀 Configuração do AmbienteInstalação RápidaBash# Clone o repositório
git clone https://github.com/seu-usuario/cofre-web3-seguro.git

# Entre na pasta
cd cofre-web3-seguro

# Use uma extensão como 'Live Server' no VSCode ou Python
python3 -m http.server 8000
Deploy do Contrato (Opcional)Se desejar usar seu próprio contrato, compile e publique o arquivo contract.sol usando o Remix IDE.📝 Smart ContractO contrato é minimalista para reduzir o custo de Gas.Solidity// Exemplo simplificado
mapping(address => string) private _vaults;

function salvarCofre(string memory _data) public {
    _vaults[msg.sender] = _data;
}
Custo Estimado: ~50,000 gas por atualização (dependendo do tamanho dos dados).🗺️ Roadmap de Evolução[ ] Q2 2026: Integração com IPFS para redução de custos de armazenamento on-chain.[ ] Q3 2026: Suporte a Account Abstraction (ERC-4337) para login sem Seed Phrase.[ ] Q4 2026: Auditoria de segurança por terceiros.🤝 ContribuiçãoFork o projeto.Crie sua Feature Branch (git checkout -b feature/NovaFeature).Commit suas mudanças (git commit -m 'Add: Nova Feature').Push para a Branch (git push origin feature/NovaFeature).Abra um Pull Request.📄 LicençaDistribuído sob a licença MIT. Veja LICENSE para mais informações.Gostou do projeto? Considere dar uma ⭐ no GitHub e ajude a promover a custódia própria de dados!