import type { Plugin } from "vite";
import path from "path";
import OpenAI from "openai";
import fsPromises from "fs/promises";
import fs from "fs";
import { sanitizeVariableName } from "./src/util/string";

interface AIGenPluginOptions {
  apiKey: string;
  baseURL: string;
  model: string;
  cacheFilePath?: string; // 新增：可选的缓存文件路径配置
}

const systemPrompt = `You are a React component generator. Given a description, generate a JSON object representing a React component with its properties. The JSON should have the following structure:

{
  "component": "string (e.g., 'div', 'button', 'input')",
  "style": {
    // Optional: CSS properties in camelCase
  },
  "children": string | Array<Component> | Component,
  // Any other props specific to the component
}

Where Component is an object with the same structure as above.

Rules:
1. The 'component' key is required and should be a valid HTML tag or React component name.
2. 'style' is optional and should contain CSS properties in camelCase.
3. 'children' should be used for any text content or nested components.
4. Any additional props should be added at the root level of the object.
5. Do not use a 'props' key; all properties should be at the root level.
6. For simple text content, use a string directly as the 'children' value.

Examples:
1. "a green div with white text that says 'Hello, AI!'"
{
  "component": "div",
  "style": {
    "backgroundColor": "green",
    "color": "white"
  },
  "children": "Hello, AI!"
}

2. "a blue button with rounded corners that says 'Click me!'"
{
  "component": "button",
  "style": {
    "backgroundColor": "blue",
    "color": "white",
    "borderRadius": "5px",
    "padding": "10px 20px",
    "border": "none"
  },
  "children": "Click me!"
}

3. "a red input field with a placeholder 'Enter your name'"
{
  "component": "input",
  "style": {
    "borderColor": "red",
    "color": "red"
  },
  "placeholder": "Enter your name",
  "type": "text"
}

Generate the JSON object based on the given description, following these rules and structure. Prioritize simplicity and directness in your interpretations.`;

async function generateComponentWithAI(
  prompt: string,
  openai: OpenAI,
  model: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    let content = response.choices[0].message.content || "{}";
    console.log("Generated component with AI:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("Generate component with AI error:", error);
    return { component: "div", children: "Generate component with AI error" };
  }
}

export default function aiGenPlugin(options: AIGenPluginOptions): Plugin {
  const defaultCacheFile = path.resolve(
    process.cwd(),
    "src",
    "ai-components-cache.json"
  );
  const cacheFile = options.cacheFilePath
    ? path.resolve(options.cacheFilePath)
    : defaultCacheFile;
  let cache = {};

  const openai = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  });

  function generateChildrenCode(children) {
    if (Array.isArray(children)) {
      return `[${children
        .map((child) => generateChildrenCode(child))
        .join(", ")}]`;
    } else if (typeof children === "object" && children !== null) {
      const { component, ...childProps } = children;
      if (component) {
        const childrenProp = childProps.children;
        delete childProps.children;
        return `React.createElement("${component}", ${JSON.stringify(
          childProps
        )}, ${generateChildrenCode(childrenProp)})`;
      } else {
        return JSON.stringify(children);
      }
    } else {
      return JSON.stringify(children);
    }
  }

  return {
    name: "vite-plugin-ai-gen",
    async configResolved() {
      try {
        await fsPromises.mkdir(path.dirname(cacheFile), { recursive: true });
        if (fs.existsSync(cacheFile)) {
          cache = JSON.parse(await fsPromises.readFile(cacheFile, "utf-8"));
          console.log("Loaded cache:", cache);
        } else {
          console.log("No cache file found, will create on first use");
        }
      } catch (error) {
        console.error(
          "Error creating cache directory or reading cache file:",
          error
        );
      }
    },
    resolveId(id) {
      if (id === "virtual:generated-components") {
        return "\0virtual:generated-components";
      }
    },
    async load(id) {
      if (id === "\0virtual:generated-components") {
        let code = `import React from 'react';\n\n`;
        for (const [key, value] of Object.entries(cache)) {
          const sanitizedKey = sanitizeVariableName(key);
          const { component, children, ...rest } = value;
          const childrenCode = generateChildrenCode(children);
          code += `export const ${sanitizedKey} = (props) => {
            return React.createElement("${component}", { ...${JSON.stringify(
            rest
          )}, ...props }, ${childrenCode});
          };\n`;
        }
        console.log("generated components code:", code);
        return code;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "POST" && req.url === "/__ai-cache") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", async () => {
            const data = JSON.parse(body);
            let cacheUpdated = false;
            for (const [key, value] of Object.entries(data)) {
              if (typeof value === "string" && !cache[key]) {
                const generatedProps = await generateComponentWithAI(
                  value,
                  openai,
                  options.model
                );
                cache[key] = generatedProps;
                cacheUpdated = true;
              }
            }
            if (cacheUpdated) {
              try {
                await fsPromises.mkdir(path.dirname(cacheFile), {
                  recursive: true,
                });
                await fsPromises.writeFile(
                  cacheFile,
                  JSON.stringify(cache, null, 2)
                );
                server.moduleGraph.invalidateAll();
                server.ws.send({ type: "full-reload" });
              } catch (error) {
                console.error("Error writing cache file:", error);
              }
            }
            res.statusCode = 200;
            res.end(JSON.stringify(cache));
          });
        } else {
          next();
        }
      });
    },
  };
}
