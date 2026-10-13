const { spawnSync } = require("node:child_process");

const advisoryId = "GHSA-vfj7-8cjw-p6xm";
const result = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  process.stderr.write(result.stderr || result.stdout || "npm audit returned no JSON output.\n");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};

function onlyKnownUnpatchedBracesAdvisory(packageName, seen = new Set()) {
  if (seen.has(packageName)) return false;
  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(packageName);

  return vulnerability.via.every((via) => {
    if (typeof via === "string") {
      return onlyKnownUnpatchedBracesAdvisory(via, nextSeen);
    }

    return (
      via &&
      typeof via === "object" &&
      typeof via.url === "string" &&
      via.url.includes(advisoryId)
    );
  });
}

const blocking = Object.entries(vulnerabilities).filter(
  ([packageName, vulnerability]) =>
    ["high", "critical"].includes(vulnerability.severity) &&
    !onlyKnownUnpatchedBracesAdvisory(packageName),
);

const waived = Object.entries(vulnerabilities).filter(
  ([packageName, vulnerability]) =>
    ["high", "critical"].includes(vulnerability.severity) &&
    onlyKnownUnpatchedBracesAdvisory(packageName),
);

if (waived.length > 0) {
  console.warn(
    `Waiving only the known unpatched ${advisoryId} advisory in the development dependency chain: ${waived.map(([name]) => name).join(", ")}.`,
  );
}

if (blocking.length > 0) {
  console.error("Unresolved high/critical dependency advisories:");
  for (const [name, vulnerability] of blocking) {
    console.error(`- ${name}: ${vulnerability.severity}; direct=${vulnerability.isDirect}`);
    for (const via of vulnerability.via || []) {
      if (via && typeof via === "object") {
        console.error(`  ${via.url || via.title || via.name || "advisory"}`);
      }
    }
  }
  process.exit(1);
}

console.log("No unresolved high/critical dependency advisories outside the documented braces exception.");
