import * as ai from "ai";

console.log("Checking convertToCoreMessages in exports:");
const keys = Object.keys(ai);
console.log(keys.filter(k => k.toLowerCase().includes("convert")));
