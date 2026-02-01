// crypto-utils.js
export const CryptoModule = {
    // Gerar senha segura usando API nativa do navegador
    generateSecurePass(length, options) {
        let chars = "";
        if (options.lower) chars += "abcdefghjkmnpqrstuvwxyz";
        if (options.upper) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ";
        if (options.numbers) chars += "23456789";
        if (options.symbols) chars += "!@#$%&*";

        let result = "";
        const array = new Uint32Array(length);
        window.crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars.charAt(array[i] % chars.length);
        }
        return result;
    },

    encrypt(data, key) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    },

    decrypt(cipher, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(cipher, key);
            const plaintext = bytes.toString(CryptoJS.enc.Utf8);
            const parsed = JSON.parse(plaintext);
            return parsed.version === "1.0" ? parsed.payload : parsed;
        } catch (e) {
            return null;
        }
    }
};