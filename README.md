# AI React Gen Example

This is a simple example of how to use AI React Gen to generate React components.

Production will not request OpenAI again and will be converted into components.


## Precautions

not production ready, just a demo

## Example

```tsx
import { ai } from "./ai-gen";

const BlueButton = ai.gen`a blue button with rounded corners that says "Click me!"`;
const RedInput = ai.gen`a red input field with a placeholder "Enter your name"`;
const GreenDiv = ai.gen`a green div with white text that says "Hello, AI!"`;

const Card = ai.gen`a div mock twitter tweet card`;
function App() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center h-screen bg-gray-100">
      <h1 className="text-5xl font-bold text-gray-800">AI React Gen Example</h1>
      <BlueButton />
      <RedInput className="w-64 px-2 py-1" />
      <GreenDiv className="w-64 px-4 py-2" />
      <Card className="w-64 px-4 py-2" />
    </div>
  );
}

export default App;
```


## Usage

1. Install dependencies

```bash
pnpm install
```

2. Create a `.env` file in the root of the project with the following environment variables:

```bash
VITE_API_KEY=<your-api-key>
VITE_BASE_URL=<your-base-url>
VITE_MODEL=<your-model>
```

3. Run the development server

```bash
pnpm dev
```

4. Build the project

```bash
pnpm build
```

