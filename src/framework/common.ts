const frameworks = ["es_extended", "qbx_core"] as const;

export const framework: (typeof frameworks)[number] | undefined = frameworks.find((name) => {
  return GetResourceState(name).startsWith("start");
});
