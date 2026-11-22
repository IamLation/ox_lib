const frameworks = {
  es_extended: ["users", "identifier"],
  qbx_core: ["players", "citizenid"],
  "qb-core": ["players", "citizenid"],
} as const;

const name = Object.keys(frameworks).find((name) => {
  return GetResourceState(name).startsWith("start");
}) as keyof typeof frameworks | undefined;

export const framework = {
  name,
  db: name ? frameworks[name] : ["", ""],
};
