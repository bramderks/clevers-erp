import fs from "node:fs";
import path from "node:path";

const schemaDir = path.resolve("prisma/schema");
const outputFile = path.resolve("prisma/schema.prisma");

const files = fs
  .readdirSync(schemaDir)
  .filter(file => file.endsWith(".prisma"))
  .sort();

console.log("Modules:");

let schema = "";

for (const file of files) {
  console.log(" +", file);

  schema += fs.readFileSync(
    path.join(schemaDir, file),
    "utf8"
  );

  schema += "\n\n";
}

fs.writeFileSync(outputFile, schema, "utf8");

console.log("");
console.log("Schema opgebouwd:");
console.log(outputFile);
console.log("");
console.log("Aantal bestanden:", files.length);