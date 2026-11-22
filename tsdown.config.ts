import { defineConfig, type UserConfig } from "tsdown";
import postBuild from "./scripts/postbuild.ts";
import joaatPlugin from "./scripts/joaat.ts";

const config: Record<string, UserConfig> = {
  resource: {
    outExtensions() {
      return { js: ".js" };
    },
    outputOptions: {
      keepNames: true,
      entryFileNames: "[name].js",
    },
    deps: {
      alwaysBundle: [/.*/],
      onlyBundle: false,
    },
    plugins: [joaatPlugin()],
  },

  client: {
    platform: "browser",
    target: "es2023",
    format: "iife",
  },

  server: {
    platform: "node",
    format: "esm",
    outDir: "./dist/server",
  },
};

const watchMode = process.argv[2] === "--watch";

function createConfig(name: string): UserConfig {
  const dropLabels = [name === "client" ? "$SERVER" : "$CLIENT"];

  if (!watchMode) dropLabels.push("$DEBUG");

  return {
    name,
    entry: {
      [name]: `./src/${name}.ts`,
    },
    tsconfig: `./tsconfig.${name}.json`,
    ...config.resource,
    ...config[name],
    inputOptions: {
      transform: { dropLabels },
    },
    onSuccess: postBuild,
  };
}

export default defineConfig([createConfig("client"), createConfig("server")]);
