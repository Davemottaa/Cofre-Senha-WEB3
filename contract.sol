// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CofreSenhas {
    // Mapeia o endereço da carteira para uma string (nossas senhas em JSON criptografado)
    mapping(address => string) private dadosCofre;

    event CofreAtualizado(address indexed usuario);

    // Salva ou atualiza os dados cifrados
    function salvarCofre(string memory _novosDados) public {
        dadosCofre[msg.sender] = _novosDados;
        emit CofreAtualizado(msg.sender);
    }

    // Recupera os dados cifrados do utilizador que chama a função
    function recuperarCofre() public view returns (string memory) {
        return dadosCofre[msg.sender];
    }
}