const fs = require('fs');
let code = fs.readFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', 'utf8');

const bStart = code.indexOf('{/* Balances Section */}');
const phStart = code.indexOf('{/* Purchase History Section */}');
const psStart = code.indexOf('{/* Purchase Subscription Section */}');
const sStart = code.indexOf('{/* Settings Section */}');
const ohStart = code.indexOf('{/* Order History Section */}');
const endMarker = code.indexOf('</div>\r\n    </div>\r\n  );\r\n}');
if (endMarker === -1) endMarker = code.indexOf('</div>\n    </div>\n  );\n}');

console.log({ bStart, phStart, psStart, sStart, ohStart, endMarker });

if (endMarker !== -1 && bStart !== -1) {
    const balances = code.substring(bStart, phStart);
    const pHistory = code.substring(phStart, psStart);
    const pSubscription = code.substring(psStart, sStart);
    const settings = code.substring(sStart, ohStart);
    const oHistory = code.substring(ohStart, endMarker);

    const newCode = code.substring(0, bStart) + 
      balances + 
      pSubscription + 
      settings + 
      oHistory + 
      pHistory + 
      code.substring(endMarker);

    fs.writeFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', newCode);
    console.log('Reordered successfully');
} else {
    console.log('Markers not found');
}
