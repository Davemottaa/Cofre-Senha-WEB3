// web3-service.js
export const Web3Service = {
    async getProvider() {
        if (!window.ethereum) throw new Error("MetaMask não encontrada");
        return new ethers.providers.Web3Provider(window.ethereum);
    },

    async signStaticMessage(signer) {
        const message = "Aceder ao Cofre Seguro: Confirme a sua identidade para desencriptar os seus dados.";
        const sig = await signer.signMessage(message);
        return ethers.utils.keccak256(sig);
    },

    async saveToBlockchain(contractAddr, abi, signer, encryptedData) {
        const contract = new ethers.Contract(contractAddr, abi, signer);
        const tx = await contract.salvarCofre(encryptedData);
        return await tx.wait();
    }
};