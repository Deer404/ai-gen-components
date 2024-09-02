import React, { useState, useEffect, useMemo } from "react";
import { sanitizeVariableName } from "./util/string";
function useAIComponent(prompt: string) {
  const [state, setState] = useState<{
    component: React.ComponentType<any> | null;
    error: string | null;
    loading: boolean;
  }>({
    component: null,
    error: null,
    loading: true,
  });
  const memoizedPrompt = useMemo(() => prompt, [prompt]);

  useEffect(() => {
    let isMounted = true;

    const fetchComponent = async () => {
      try {
        const generatedComponents = await import(
          "virtual:generated-components"
        );
        const sanitizedPrompt = sanitizeVariableName(memoizedPrompt);
        if (generatedComponents[sanitizedPrompt]) {
          if (isMounted)
            setState({
              component: generatedComponents[sanitizedPrompt],
              error: null,
              loading: false,
            });
        } else {
          console.log("组件未找到，正在请求生成");
          const response = await fetch("/__ai-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [memoizedPrompt]: memoizedPrompt }),
          });
          const updatedCache = await response.json();
          if (updatedCache[memoizedPrompt]) {
            // 使用返回的缓存数据立即更新组件
            const Component = (props: any) =>
              React.createElement(updatedCache[memoizedPrompt].component, {
                ...updatedCache[memoizedPrompt],
                ...props,
              });
            if (isMounted)
              setState({
                component: Component,
                error: null,
                loading: false,
              });
          }
        }
      } catch (error) {
        console.error("获取AI组件时出错:", error);
        if (isMounted)
          setState({
            component: null,
            error: `加载组件 "${memoizedPrompt}" 时出错: ${error.message}`,
            loading: false,
          });
      }
    };

    fetchComponent();

    return () => {
      isMounted = false;
    };
  }, [memoizedPrompt]);

  return state;
}

export const ai = {
  gen: (strings: TemplateStringsArray, ...values: any[]) => {
    const prompt = strings.reduce(
      (acc, str, i) => acc + str + (values[i] || ""),
      ""
    );
    return React.memo((props: any) => {
      const { component, error, loading } = useAIComponent(prompt);

      if (loading) {
        return <div>加载中...</div>;
      }

      if (error) {
        return <div>{error}</div>;
      }

      return component ? React.createElement(component, props) : null;
    });
  },
};
