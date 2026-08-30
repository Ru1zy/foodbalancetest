const fs = require('fs');
const file = 'app/checkout/page-impl.tsx';
let content = fs.readFileSync(file, 'utf8');
const target = `  useEffect(() => {
    if (!authenticatedUser || customerProfile.isAuthenticated) {
      return;
    }

    setCustomerProfile({
      address: authenticatedUser.address || "",
      cutlery: authenticatedUser.defaultCutlery || 0,
      isAuthenticated: true,
      name: authenticatedUser.name,
      phone: authenticatedUser.phone || "",
      userId: "",
      chatId: "",
      notes: "",
      username: "",
    });
  }, [authenticatedUser, customerProfile.isAuthenticated, setCustomerProfile]);`;
const replacement = `  useEffect(() => {
    if (authenticatedUser && !customerProfile.isAuthenticated) {
      setCustomerProfile({
        address: authenticatedUser.address || "",
        cutlery: authenticatedUser.defaultCutlery || 0,
        isAuthenticated: true,
        name: authenticatedUser.name,
        phone: authenticatedUser.phone || "",
        userId: "",
        chatId: "",
        notes: "",
        username: "",
      });
    } else if (!authenticatedUser && customerProfile.isAuthenticated) {
      setCustomerProfile({ isAuthenticated: false });
    }
  }, [authenticatedUser, customerProfile.isAuthenticated, setCustomerProfile]);`;
content = content.replace(target, replacement);
fs.writeFileSync(file, content);
