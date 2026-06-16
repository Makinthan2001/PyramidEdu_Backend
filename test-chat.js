const axios = require('axios');

async function testChat() {
  try {
    console.log("Sending chat request...");
    const res = await axios.post('http://localhost:5000/api/v1/chat/ask', {
      question: "What is RAG?"
    });
    console.log("Success:", res.data);
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

testChat();
