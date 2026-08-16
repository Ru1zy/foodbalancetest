const fs = require('fs');
let code = fs.readFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', 'utf8');

const s_balances = code.match(/\{\/\* Balances Section \*\/\}[\s\S]*?(?=\s*\{\/\* Purchase History Section \*\/)/)[0];
const s_pHistory = code.match(/\{\/\* Purchase History Section \*\/\}[\s\S]*?(?=\s*\{\/\* Purchase Subscription Section \*\/)/)[0];
const s_pSub = code.match(/\{\/\* Purchase Subscription Section \*\/\}[\s\S]*?(?=\s*\{\/\* Settings Section \*\/)/)[0];
const s_settings = code.match(/\{\/\* Settings Section \*\/\}[\s\S]*?(?=\s*\{\/\* Order History Section \*\/)/)[0];
const s_oHistory = code.match(/\{\/\* Order History Section \*\/\}[\s\S]*?(?=\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\);\r?\n\})/)[0];

const fullMatch = code.match(/(\{\/\* Balances Section \*\/[\s\S]*\{\/\* Order History Section \*\/[\s\S]*?)(?=\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\);\r?\n\})/);

if (!fullMatch) {
    console.error("Failed to match full section");
    process.exit(1);
}

const oldSection = fullMatch[0];

const newSection = s_settings + '\n\n        ' + s_pSub + '\n\n        ' + s_balances + '\n\n        ' + s_oHistory + '\n\n        ' + s_pHistory;

const newCode = code.replace(oldSection, newSection);
fs.writeFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', newCode);
console.log("Successfully replaced!");
