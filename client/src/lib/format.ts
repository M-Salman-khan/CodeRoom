import type { Plugin } from "prettier";

/**
 * Languages supported by the in-browser formatter. Prettier is loaded lazily
 * the first time the user formats a document, so it never bloats the initial
 * editor bundle.
 */
export const FORMATTABLE_EXTENSIONS = [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "json",
  "jsonc",
  "json5",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "vue",
  "md",
  "markdown",
  "yaml",
  "yml",
  "java",
] as const;

export function isFormatSupported(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (FORMATTABLE_EXTENSIONS as readonly string[]).includes(ext);
}

export async function formatCode(code: string, fileName: string): Promise<string | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!isFormatSupported(fileName)) return null;

  const prettier = await import("prettier/standalone");
  const plugins: Plugin[] = [];
  let parser: string;

  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "json":
    case "jsonc":
    case "json5":
      plugins.push(
        await import("prettier/plugins/babel"),
        await import("prettier/plugins/estree")
      );
      parser = ext.startsWith("json") ? ext : "babel";
      break;

    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      plugins.push(
        await import("prettier/plugins/typescript"),
        await import("prettier/plugins/estree")
      );
      parser = "typescript";
      break;

    case "css":
    case "scss":
    case "less":
      plugins.push(await import("prettier/plugins/postcss"));
      parser = ext;
      break;

    case "html":
    case "htm":
    case "vue":
      plugins.push(await import("prettier/plugins/html"));
      parser = ext === "vue" ? "vue" : "html";
      break;

    case "md":
    case "markdown":
      plugins.push(await import("prettier/plugins/markdown"));
      parser = "markdown";
      break;

    case "yaml":
    case "yml":
      plugins.push(await import("prettier/plugins/yaml"));
      parser = "yaml";
      break;

    case "java": {
      const javaPlugin = await import("prettier-plugin-java");
      plugins.push(javaPlugin.default as unknown as Plugin);
      parser = "java";
      break;
    }

    default:
      return null;
  }

  const formatted = await prettier.format(code, {
    parser,
    plugins,
    tabWidth: 2,
    printWidth: 100,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
  });

  return formatted;
}
