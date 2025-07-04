### Cohere Chat API

The Cohere Chat API generates a text response to a user message.

To use the Cohere Chat API with Bun.js and TypeScript, you can use the `fetch` API. Here is a basic example:

```typescript
const COHERE_API_KEY = "YOUR_COHERE_API_KEY";

async function chat() {
  const response = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "command-a-03-2025",
      messages: [{"role": "user", "content": "hello world!"}],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log(data);
}

chat();
```

**Features:**

*   **`model`**: The name of the Cohere model to use.
*   **`messages`**: A list of chat messages representing the conversation history. Messages can have roles: `User`, `Assistant`, `Tool`, and `System`.
*   **`tools`**: A list of available functions the model can call.
*   **`documents`**: A list of relevant documents for the model to cite in its response.
*   **`stream`**: When set to `true`, the response is a server-sent event (SSE) stream.
*   **`temperature`**: A float that controls the randomness of the generation.

### Cohere Embed API

The Cohere Embed API returns text embeddings, which are lists of floating-point numbers representing the semantic information of the text.

Here is a basic example of how to use the Embed API with Bun.js and TypeScript:

```typescript
const COHERE_API_KEY = "YOUR_COHERE_API_KEY";

async function embed() {
  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      texts: ["hello", "goodbye"],
      model: "embed-v4.0",
      input_type: "classification",
      embedding_types: ["float"],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log(data);
}

embed();
```