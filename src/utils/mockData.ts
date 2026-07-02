// Mock data for the application
// Asset Types
export const assetTypes = ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Phone', 'Tablet', 'Printer', 'Server', 'Router', 'Switch', 'Projector', 'Camera', 'Furniture', 'Vehicle'];
// Manufacturers
export const manufacturers = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Cisco', 'Logitech', 'Canon', 'Epson', 'LG', 'ASUS', 'Acer', 'Sony', 'Brother'];
// Departments
export const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Legal', 'R&D', 'Customer Support', 'Executive'];
// Locations
export const locations = ['Turnkey Africa', 'Branch Office - North', 'Branch Office - South', 'Branch Office - East', 'Branch Office - West', 'Data Center', 'Remote'];
// Asset Status
export const assetStatuses = ['Available', 'Assigned', 'In Maintenance', 'Reserved', 'Disposed'];
// Asset Conditions
export const assetConditions = ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective'];
// Issue Status
export const issueStatuses = ['Open', 'In Progress', 'Pending User Action', 'Pending Parts', 'Resolved', 'Closed'];
// Issue Types
export const issueTypes = ['Hardware Failure', 'Software Issue', 'Connectivity Problem', 'Upgrade Request', 'Replacement Request', 'Maintenance', 'Other'];
// Generate mock assets
export const generateMockAssets = (count = 50) => {
  const assets = [];
  for (let i = 0; i < count; i++) {
    const assetType = assetTypes[Math.floor(Math.random() * assetTypes.length)];
    const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const status = assetStatuses[Math.floor(Math.random() * assetStatuses.length)];
    const condition = assetConditions[Math.floor(Math.random() * assetConditions.length)];
    // Generate a random purchase date within the last 5 years
    const purchaseDate = new Date();
    purchaseDate.setFullYear(purchaseDate.getFullYear() - Math.floor(Math.random() * 5));
    purchaseDate.setMonth(Math.floor(Math.random() * 12));
    purchaseDate.setDate(Math.floor(Math.random() * 28) + 1);
    // Generate a random warranty end date
    const warrantyEndDate = new Date(purchaseDate);
    warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + Math.floor(Math.random() * 3) + 1);
    // Generate a random serial number
    const serialNumber = `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    // Generate a random model based on manufacturer
    const models = {
      Dell: ['Latitude', 'Precision', 'XPS', 'Inspiron', 'OptiPlex'],
      HP: ['EliteBook', 'ProBook', 'Pavilion', 'Envy', 'Spectre'],
      Lenovo: ['ThinkPad', 'IdeaPad', 'Yoga', 'Legion', 'ThinkCentre'],
      Apple: ['MacBook Pro', 'MacBook Air', 'iMac', 'Mac Mini', 'Mac Pro'],
      Microsoft: ['Surface Pro', 'Surface Laptop', 'Surface Book', 'Surface Studio', 'Surface Go'],
      Samsung: ['Galaxy Book', 'Odyssey', 'Notebook 9', 'Chromebook', 'Series 7'],
      Cisco: ['Catalyst', 'Nexus', 'ISR', 'ASR', 'Meraki'],
      Logitech: ['MX Master', 'G Pro', 'K Series', 'Brio', 'StreamCam'],
      Canon: ['ImageCLASS', 'PIXMA', 'MAXIFY', 'imagePROGRAF', 'i-SENSYS'],
      Epson: ['WorkForce', 'Expression', 'EcoTank', 'SureColor', 'LabelWorks'],
      LG: ['Gram', 'Ultra', 'UltraFine', 'UltraWide', 'UltraGear'],
      ASUS: ['ZenBook', 'VivoBook', 'ROG', 'TUF', 'ProArt'],
      Acer: ['Aspire', 'Swift', 'Predator', 'Nitro', 'ConceptD'],
      Sony: ['VAIO', 'Bravia', 'Alpha', 'Cyber-shot', 'Handycam'],
      Brother: ['HL-Series', 'MFC-Series', 'DCP-Series', 'PJ-Series', 'PT-Series']
    };
    const model = models[manufacturer] ? models[manufacturer][Math.floor(Math.random() * models[manufacturer].length)] : `Model-${Math.floor(Math.random() * 1000)}`;
    // Generate a random asset image based on type
    const assetImages = {
      Laptop: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=987&q=80', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'],
      Desktop: ['https://images.unsplash.com/photo-1593640495253-23196b27a87f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1742&q=80', 'https://images.unsplash.com/photo-1547082299-de196ea013d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80'],
      Monitor: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80', 'https://images.unsplash.com/photo-1616763355548-1b606f439f86?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80'],
      Keyboard: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80', 'https://images.unsplash.com/photo-1561112078-7d24e04c3407?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1465&q=80'],
      Mouse: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1465&q=80', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1467&q=80'],
      Phone: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1160&q=80', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1529&q=80']
    };
    const defaultImage = 'https://images.unsplash.com/photo-1563770660941-20978e870e26?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80';
    const imageArray = assetImages[assetType] || [defaultImage];
    const image = imageArray[Math.floor(Math.random() * imageArray.length)];
    // Generate assigned user if status is 'Assigned'
    const assignedUser = status === 'Assigned' ? {
      id: `U-${Math.floor(Math.random() * 1000)}`,
      name: `User ${Math.floor(Math.random() * 100)}`,
      email: `user${Math.floor(Math.random() * 100)}@turnkeyafrica.com`
    } : null;
    
    // Add assignedUserId for easier filtering
    const assignedUserId = assignedUser ? assignedUser.id : null;
    assets.push({
      id: `A-${i + 1}`,
      name: `${manufacturer} ${model} ${assetType}`,
      type: assetType,
      manufacturer,
      model,
      serialNumber,
      purchaseDate: purchaseDate.toISOString(),
      warrantyEndDate: warrantyEndDate.toISOString(),
      department,
      location,
      status,
      condition,
      assignedUser,
      assignedUserId,
      image,
      notes: `This is a ${condition.toLowerCase()} condition ${manufacturer} ${assetType} at Caava Group.`
    });
  }
  return assets;
};
// Generate mock issues
export const generateMockIssues = (assets, count = 30) => {
  const issues = [];
  for (let i = 0; i < count; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const status = issueStatuses[Math.floor(Math.random() * issueStatuses.length)];
    const type = issueTypes[Math.floor(Math.random() * issueTypes.length)];
    // Generate a random created date within the last 30 days
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30));
    // Generate a random updated date after created date
    const updatedDate = new Date(createdDate);
    updatedDate.setDate(updatedDate.getDate() + Math.floor(Math.random() * 5));
    // Generate a random resolved date for resolved issues
    const resolvedDate = status === 'Resolved' || status === 'Closed' ? new Date(updatedDate.setDate(updatedDate.getDate() + Math.floor(Math.random() * 3))) : null;
    issues.push({
      id: `I-${i + 1}`,
      title: `${type} - ${asset.name}`,
      description: `Issue with ${asset.name}: ${type.toLowerCase()} needs attention at Caava Group.`,
      assetId: asset.id,
      assetName: asset.name,
      assetImage: asset.image,
      status,
      type,
      priority: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
      createdBy: asset.assignedUser ? asset.assignedUser : {
        id: `U-${Math.floor(Math.random() * 1000)}`,
        name: `User ${Math.floor(Math.random() * 100)}`,
        email: `user${Math.floor(Math.random() * 100)}@turnkeyafrica.com`
      },
      assignedTo: status !== 'Open' ? {
        id: `U-${Math.floor(Math.random() * 1000)}`,
        name: `IT Support ${Math.floor(Math.random() * 10)}`,
        email: `support${Math.floor(Math.random() * 10)}@turnkeyafrica.com`
      } : null,
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      resolvedAt: resolvedDate ? resolvedDate.toISOString() : null,
      comments: [{
        id: `C-${i}-1`,
        text: `Reported ${type.toLowerCase()} issue with the ${asset.name} at Caava Group.`,
        createdBy: asset.assignedUser ? asset.assignedUser.name : `User ${Math.floor(Math.random() * 100)}`,
        createdAt: createdDate.toISOString()
      }]
    });
    // Add more comments for non-open issues
    if (status !== 'Open') {
      const commentDate = new Date(createdDate);
      commentDate.setDate(commentDate.getDate() + 1);
      issues[i].comments.push({
        id: `C-${i}-2`,
        text: `I've started investigating this issue.`,
        createdBy: `IT Support ${Math.floor(Math.random() * 10)}`,
        createdAt: commentDate.toISOString()
      });
      if (status === 'Resolved' || status === 'Closed') {
        const resolveCommentDate = new Date(commentDate);
        resolveCommentDate.setDate(resolveCommentDate.getDate() + 1);
        issues[i].comments.push({
          id: `C-${i}-3`,
          text: `Issue has been resolved. ${type} was fixed by ${['replacing the part', 'updating the software', 'reconfiguring settings', 'restarting the system'][Math.floor(Math.random() * 4)]}.`,
          createdBy: `IT Support ${Math.floor(Math.random() * 10)}`,
          createdAt: resolveCommentDate.toISOString()
        });
      }
    }
  }
  return issues;
};
// Generate mock users
export const generateMockUsers = (count = 20) => {
  const users = [];
  // Add admin user
  users.push({
    id: 'U-admin',
    name: 'Admin User',
    email: 'admin@turnkeyafrica.com',
    role: 'admin',
    department: 'IT',
    position: 'IT Administrator',
    phone: '+254-700-000-000',
    image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1160&q=80'
  });
  // Add regular users
  for (let i = 0; i < count; i++) {
    const department = departments[Math.floor(Math.random() * departments.length)];
    const role = Math.random() > 0.8 ? 'department_officer' : 'user';
    users.push({
      id: `U-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@turnkeyafrica.com`,
      role,
      department,
      position: `${department} ${role === 'department_officer' ? 'Manager' : 'Staff'}`,
      phone: `+254-700-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      image: `https://i.pravatar.cc/150?img=${i + 10}`
    });
  }
  return users;
};

// Generate mock assets for a specific user
export const generateMockUserAssets = (userId: string, count = 10) => {
  const allAssets = generateMockAssets(count * 3); // Generate more assets to ensure some are assigned to the user
  const userAssets = allAssets.filter(asset => asset.assignedUserId === userId);
  
  // If no assets are assigned to the user, create some mock assigned assets
  if (userAssets.length === 0) {
    const assetTypes = ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Phone', 'Tablet'];
    const manufacturers = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft'];
    
    for (let i = 0; i < count; i++) {
      const assetType = assetTypes[Math.floor(Math.random() * assetTypes.length)];
      const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
      const serialNumber = `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      userAssets.push({
        id: `UA-${i + 1}`,
        name: `${manufacturer} ${assetType} - User Asset`,
        type: assetType,
        manufacturer,
        model: `Model-${Math.floor(Math.random() * 1000)}`,
        serialNumber,
        purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        warrantyEndDate: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        department: 'IT',
        location: 'Turnkey Africa',
        status: 'Assigned',
        condition: ['New', 'Excellent', 'Good'][Math.floor(Math.random() * 3)],
        assignedUser: {
          id: userId,
          name: 'Current User',
          email: 'user@turnkeyafrica.com'
        },
        assignedUserId: userId,
        image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
        notes: `This ${assetType} is assigned to you.`
      });
    }
  }
  
  return userAssets;
};
