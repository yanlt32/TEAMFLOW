// Simple test script
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testLogin() {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'joao@empresa.com', password: '123456' })
    });

    const data = await response.json();
    console.log('Login test:', response.ok ? 'SUCCESS' : 'FAILED', data);

    if (response.ok) {
      // Test getting emotions
      const emotionsResponse = await fetch(`${API_BASE}/emotions`, {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      const emotions = await emotionsResponse.json();
      console.log('Emotions test:', emotionsResponse.ok ? 'SUCCESS' : 'FAILED', emotions);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLogin();