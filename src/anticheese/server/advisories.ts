const convars = [
  { name: "sv_stateBagStrictMode", recommended: true, default: false },
  { name: "sv_enableNetworkedSounds", recommended: false, default: false },
  { name: "sv_enableNetworkedPhoneExplosions", recommended: false, default: false },
  { name: "sv_protectServerEntities", recommended: true, default: false },
  { name: "sv_enableNetworkedScriptEntityStates", recommended: false, default: true },
  { name: "sv_filterRequestControl", recommended: 2, default: 0 },
  { name: "sv_scriptHookAllowed", recommended: false, default: false },
];

setTimeout(() => {
  const ignoreAdvisories = new Set(JSON.parse(GetConvar("ox:ignoreSecurityAdvisory", "[]")));
  const settings: string[] = [];

  for (const { name, recommended, default: defaultValue } of convars) {
    if (ignoreAdvisories.has(`sv_${name}`)) continue;

    const value = JSON.parse(GetConvar(name, String(defaultValue)));

    if (value === recommended || (typeof recommended === "number" && value >= recommended)) continue;

    const recommendation = typeof recommended === "number" ? "recommended minimum" : "recommended";
    settings.push(`^3• ${name} ${value} ^2(${recommendation} ${recommended})`);
  }

  if (!settings.length) return;

  console.warn(`Found ${settings.length} unsafe convars values.^0
${settings.join("\n")}
^0See ^4https://docs.fivem.net/docs/server-manual/server-commands/^0 for details.`);
}, 2000);
