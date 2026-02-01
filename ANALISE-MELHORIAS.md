# Análise do Projeto – Cofre Web3 Seguro

Análise para identificar melhorias e ajustes em segurança, código, UX e manutenção.

---

## Crítico (corrigir primeiro)

### 1. Segurança – Log de dados sensíveis
- **Onde:** `app.js`, função `decryptFull()`.
- **Problema:** `console.log("Conteúdo descriptografado (bruto):", plaintext)` imprime o conteúdo descriptografado (incluindo senhas) no console do navegador.
- **Risco:** Qualquer pessoa com acesso ao DevTools vê as senhas em texto claro.
- **Ação:** Remover este `console.log` em produção.

### 2. Segurança – Campo de senha em texto claro
- **Onde:** `index.html`, input `#sitePass`.
- **Problema:** O campo está com `type="text"`, então a senha fica sempre visível.
- **Ação:** Usar `type="password"` e, se quiser, um botão “mostrar/ocultar” só nesse campo.

### 3. Bug – Modal de loading não fecha em erro
- **Onde:** `app.js`, `downloadFromBlockchain()`.
- **Problema:** No `catch`, não é chamado `hideProcessing()`. Se der erro ao carregar (rede, contrato, etc.), o modal “A Carregar Senhas” fica aberto.
- **Ação:** Chamar `hideProcessing()` no bloco `catch` (e garantir que em todos os `return` antecipados o modal seja fechado, se necessário).

### 4. Código morto / inconsistência de módulos
- **Onde:** `crypto-utils.js` e `web3-service.js` usam `export` (ES modules).
- **Problema:** O `index.html` carrega apenas `app.js` como script clássico (sem `type="module"`). Esses dois ficheiros nunca são importados; a lógica está duplicada em `app.js`.
- **Ação:** Ou (a) passar a usar módulos: carregar um único `type="module"` que importe `crypto-utils`, `web3-service` e a lógica do app, ou (b) remover `crypto-utils.js` e `web3-service.js` e manter tudo em `app.js` para evitar confusão.

---

## Importante (melhorar em breve)

### 5. Gerador de senhas – Aleatoriedade
- **Onde:** `app.js`, `generateRandomPass()`.
- **Problema:** Usa `Math.random()`, que não é criptograficamente seguro.
- **Sugestão:** Usar `window.crypto.getRandomValues()` (como já está em `crypto-utils.js` em `generateSecurePass`) para gerar os índices dos caracteres.

### 6. Validação do endereço do contrato repetida
- **Onde:** `saveAndSync()`, `downloadFromBlockchain()`, `deleteAndSync()`.
- **Problema:** O mesmo bloco (endereço não null, `startsWith('0x')`, `length === 42`) repete-se em vários sítios.
- **Sugestão:** Centralizar em `getContractAddressForCurrentNetwork()` e considerar que essa função “só” devolve um endereço já válido (ou null). Assim evita duplicar a validação em cada função.

### 7. IDs dos botões no HTML vs listeners no JS
- **Onde:** `app.js` (DOMContentLoaded) procura `#btnConnect` e `#btnSave`.
- **Problema:** No HTML, o botão de conectar não tem `id="btnConnect"` e o de guardar não tem `id="btnSave"`; os botões usam `onclick` no HTML. Os `addEventListener` não se ligam a nenhum elemento.
- **Impacto:** O app funciona por causa dos `onclick` no HTML; os listeners são redundantes.
- **Sugestão:** Ou adicionar `id="btnConnect"` e `id="btnSave"` no HTML e manter os listeners, ou remover os listeners no JS e deixar apenas os `onclick` (e documentar que a interação é feita pelo HTML).

### 8. `secureClear()` e elementos do DOM
- **Onde:** `secureClear()` acede a `siteName`, `siteUser`, `sitePass`, `passwordList`, `btn-copy-generated`.
- **Problema:** Se a função for chamada num estado em que a secção do app não está visível (por exemplo, após logout), tecnicamente os elementos existem, mas é frágil depender disso.
- **Sugestão:** Verificar `document.getElementById(...)` antes de usar (ou usar optional chaining / guard clauses) para evitar erros se a estrutura do HTML mudar.

---

## UX e consistência

### 9. Mensagem quando a lista de senhas está vazia
- **Onde:** `renderPasswords()`.
- **Problema:** Quando `passwords.length === 0`, a lista fica em branco. Pode não ser óbvio que “não há senhas” em vez de “não carregou”.
- **Sugestão:** Mostrar um texto explícito, por exemplo: “Ainda não tem senhas guardadas. Use o formulário acima para adicionar a primeira.”

### 10. Aviso “Senha ocultada por segurança”
- **Onde:** `renderPasswords()`, timeout de 30 segundos.
- **Problema:** Abre o modal de status (“Aviso”, “Senha ocultada por segurança”), que pode ser intrusivo.
- **Sugestão:** Considerar um toast ou mensagem mais pequena e não bloqueante, ou apenas esconder a senha sem modal.

### 11. Consistência de português (PT vs BR)
- **Problema:** Mistura de PT-PT (guardar, utilizador, ecrã, “Atualizar Cofre”) e PT-BR (por exemplo, “você” em mensagens de erro).
- **Sugestão:** Escolher uma variante (PT-PT ou PT-BR) e usar em todos os textos da UI e mensagens de erro.

---

## Manutenção e boas práticas

### 12. Logs no console
- **Onde:** Vários `console.log` e `console.error` em `app.js`.
- **Sugestão:** Em produção, reduzir ao mínimo (por exemplo, só erros graves). Pode usar uma variável `DEBUG` ou ambiente (ex.: `if (DEBUG) console.log(...)`).

### 13. Constante “20” em `downloadFromBlockchain`
- **Onde:** `if (data && data.length > 20)`.
- **Problema:** O número 20 é um “magic number”; não fica claro que é um limite mínimo para considerar que há dados (por exemplo, um JSON mínimo).
- **Sugestão:** Definir uma constante, por exemplo `MIN_ENCRYPTED_LENGTH = 20`, e usar no `if`.

### 14. Comentários e documentação
- **Sugestão:** Manter comentários apenas onde explicam “porquê” (por exemplo, mensagem fixa para a chave de encriptação). Remover comentários óbvios ou redundantes (ex.: “FIX: …”) quando o código já estiver estável.

### 15. Contrato e custo de gas
- **Onde:** `contract.sol`, `salvarCofre(string)`.
- **Nota:** Guardar uma string grande na blockchain é custoso em gas. Está correto para o modelo “um blob por utilizador”; vale a pena avisar o utilizador (por exemplo na UI) de que cada “Guardar” gera uma transação e que muitas senhas = payload maior = mais gas.

---

## Resumo de prioridades

| Prioridade | Item                          | Tipo        |
|-----------|--------------------------------|-------------|
| 1         | Remover log do plaintext       | Segurança   |
| 2         | type="password" no campo senha | Segurança   |
| 3         | hideProcessing() no catch      | Bug         |
| 4         | Módulos ou remover ficheiros   | Código      |
| 5         | Gerador com getRandomValues    | Segurança   |
| 6         | Centralizar validação contrato | Manutenção  |
| 7         | IDs dos botões / listeners     | Consistência|
| 8         | Mensagem lista vazia           | UX          |
| 9         | Menos logs em produção         | Boas práticas |

Se quiser, posso aplicar no código as correções dos itens 1, 2 e 3 (críticos) e opcionalmente o 8 (mensagem da lista vazia) e o 13 (constante para o 20).
