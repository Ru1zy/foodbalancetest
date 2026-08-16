const fs = require('fs');
const lines = fs.readFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', 'utf8').split('\n');

const getRange = (startMarker, endMarkerOrEOF) => {
    const start = lines.findIndex(l => l.includes(startMarker));
    let end = lines.findIndex((l, i) => i > start && endMarkerOrEOF.some(m => l.includes(m)));
    if (end === -1) end = lines.length;
    return lines.slice(start, end);
};

const markers = [
    '{/* Balances Section */}',
    '{/* Purchase History Section */}',
    '{/* Purchase Subscription Section */}',
    '{/* Settings Section */}',
    '{/* Order History Section */}',
    '      </div>', // The closing of the max-w-5xl div
];

const bStart = lines.findIndex(l => l.includes('{/* Balances Section */}'));
const before = lines.slice(0, bStart);

const balances = getRange('{/* Balances Section */}', markers.slice(1));
const pHistory = getRange('{/* Purchase History Section */}', markers.slice(2));
const pSub = getRange('{/* Purchase Subscription Section */}', markers.slice(3));
const settings = getRange('{/* Settings Section */}', markers.slice(4));
const oHistory = getRange('{/* Order History Section */}', ['      </div>\r', '      </div>\n', '      </div>']);

// Find where oHistory ends
const oHistoryEndIdx = lines.findIndex((l, i) => i > lines.findIndex(l => l.includes('{/* Order History Section */}')) && l === '      </div>\r');
// Actually, let's just grab the end directly:
const endTagsStart = lines.findIndex((l, i) => i > lines.length - 10 && l.trim() === '</div>' && lines[i+1].trim() === '</div>');

const end = lines.slice(endTagsStart);

// Now the oHistory is exactly from its start to endTagsStart
const oStart = lines.findIndex(l => l.includes('{/* Order History Section */}'));
const oHistoryExact = lines.slice(oStart, endTagsStart);

const desired = [
    ...before,
    ...settings,
    ...pSub,
    ...balances,
    ...oHistoryExact,
    ...pHistory,
    ...end
];

fs.writeFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', desired.join('\n'));
console.log('Done!');
