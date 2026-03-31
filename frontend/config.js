// config.js - Configuração dinâmica da API
(function() {
    console.log('🔍 Detectando servidor MindTrack...');
    
    // Lista de portas possíveis para testar
    const possiblePorts = [3002, 3001, 3000, 3003, 3004, 3005];
    
    // Função para testar se uma porta responde
    async function testPort(port) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos timeout
            
            const response = await fetch(`http://localhost:${port}/api/health`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Servidor encontrado na porta ${port}`, data);
                return true;
            }
        } catch (e) {
            // Porta não responde, continua
        }
        return false;
    }
    
    // Função principal para descobrir a porta
    async function discoverServerPort() {
        for (const port of possiblePorts) {
            console.log(`🔍 Testando porta ${port}...`);
            const isAvailable = await testPort(port);
            if (isAvailable) {
                return port;
            }
        }
        
        console.warn('⚠️ Nenhum servidor encontrado nas portas:', possiblePorts);
        console.warn('⚠️ Usando porta padrão 3000 como fallback');
        return 3000;
    }
    
    // Inicialização
    (async function init() {
        const port = await discoverServerPort();
        const API_URL = `http://localhost:${port}/api`;
        
        window.APP_CONFIG = {
            API_URL: API_URL,
            PORT: port,
            VERSION: '1.0.0'
        };
        
        console.log(`📡 API configurada para: ${API_URL}`);
        
        // Disparar evento de configuração carregada
        window.dispatchEvent(new CustomEvent('apiConfigLoaded', { 
            detail: { apiUrl: API_URL } 
        }));
    })();
})();