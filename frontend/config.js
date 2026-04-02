// config.js - Configuração dinâmica da API
(function() {
    console.log('🔍 Detectando servidor MindTrack...');
    
    // Detectar se está em produção (Render) ou desenvolvimento
    const isProduction = window.location.hostname !== 'localhost' && 
                        !window.location.hostname.includes('127.0.0.1');
    
    // Em produção, usar a URL atual do servidor
    if (isProduction) {
        const API_URL = `${window.location.protocol}//${window.location.hostname}/api`;
        window.APP_CONFIG = {
            API_URL: API_URL,
            PORT: window.location.port || 80,
            VERSION: '1.0.0'
        };
        console.log(`📡 API configurada para (produção): ${API_URL}`);
        window.dispatchEvent(new CustomEvent('apiConfigLoaded', { 
            detail: { apiUrl: API_URL } 
        }));
        return;
    }
    
    // Em desenvolvimento, testar portas locais
    const possiblePorts = [3000, 3001, 3002, 3003, 3004, 3005];
    
    async function testPort(port) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
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
    
    (async function init() {
        const port = await discoverServerPort();
        const API_URL = `http://localhost:${port}/api`;
        
        window.APP_CONFIG = {
            API_URL: API_URL,
            PORT: port,
            VERSION: '1.0.0'
        };
        
        console.log(`📡 API configurada para: ${API_URL}`);
        
        window.dispatchEvent(new CustomEvent('apiConfigLoaded', { 
            detail: { apiUrl: API_URL } 
        }));
    })();
})();