const fs = require('fs');
const content = fs.readFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', 'utf8');

// The layout currently is:
// [Header]
// {/* Balances Section */}
// {/* Purchase History Section */}
// {/* Purchase Subscription Section */}
// {/* Settings Section */}
// {/* Order History Section */}
// [Footer]

const split1 = content.split('{/* Balances Section */}');
const beforeBalances = split1[0];
const rest1 = split1[1];

const split2 = rest1.split('{/* Purchase History Section */}');
const balances = '{/* Balances Section */}' + split2[0];
const rest2 = split2[1];

const split3 = rest2.split('{/* Purchase Subscription Section */}');
const pHistory = '{/* Purchase History Section */}' + split3[0];
const rest3 = split3[1];

const split4 = rest3.split('{/* Settings Section */}');
const pSubscription = '{/* Purchase Subscription Section */}' + split4[0];
const rest4 = split4[1];

const split5 = rest4.split('{/* Order History Section */}');
const settings = '{/* Settings Section */}' + split5[0];
const oHistory = '{/* Order History Section */}' + split5[1];

// Desired order:
// 1. Purchase Subscription
// 2. Balances
// 3. Settings
// 4. Order History
// 5. Purchase History

const newContent = beforeBalances + pSubscription + balances + settings + oHistory + pHistory;

fs.writeFileSync('D:/foodbalance/app/profile/ProfilePageClient.tsx', newContent);
console.log('Reordered successfully without breaking anything!');
