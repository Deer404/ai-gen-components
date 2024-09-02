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
          content:
            "You are a React component generator. Given a description, generate a JSON object representing a React component with its properties. The JSON should have a 'component' key for the component type, and other keys for its properties.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content || "{}";
    content = content.replace(/```json\n|\n```/g, "");
    return JSON.parse(content);
  } catch (error) {
    console.error("生成AI组件时出错:", error);
    return { component: "div", children: "生成组件时出错" };
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
    dangerouslyAllowBrowser: true,
  });

  return {
    name: "vite-plugin-ai-gen",
    async configResolved() {
      try {
        await fsPromises.mkdir(path.dirname(cacheFile), { recursive: true });
        if (fs.existsSync(cacheFile)) {
          cache = JSON.parse(await fsPromises.readFile(cacheFile, "utf-8"));
          console.log("已加载缓存:", cache);
        } else {
          console.log("未找到缓存文件，将在首次使用时创建");
        }
      } catch (error) {
        console.error("创建缓存目录或读取缓存文件时出错:", error);
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
          code += `export const ${sanitizedKey} = (props) => React.createElement("${
            value.component
          }", { ...${JSON.stringify(value)}, ...props });\n`;
        }
        console.log("生成的组件内容:", code);
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
                console.error("写入缓存文件时出错:", error);
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
