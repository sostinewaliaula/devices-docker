INSERT INTO dropdown_options (type, value, is_active) VALUES
-- Manufacturers
('manufacturer', 'Dell', 1),
('manufacturer', 'HP', 1),
('manufacturer', 'Lenovo', 1),
('manufacturer', 'Apple', 1),
('manufacturer', 'Microsoft', 1),
('manufacturer', 'Samsung', 1),
('manufacturer', 'Cisco', 1),
('manufacturer', 'Logitech', 1),
('manufacturer', 'Canon', 1),
('manufacturer', 'Epson', 1),
('manufacturer', 'LG', 1),
('manufacturer', 'ASUS', 1),
('manufacturer', 'Acer', 1),
('manufacturer', 'Sony', 1),
('manufacturer', 'Brother', 1),

-- Categories
('category', 'Electronics', 1),
('category', 'Furniture', 1),
('category', 'Vehicles', 1),
('category', 'Office Equipment', 1),
('category', 'Software', 1),
('category', 'Other', 1),

-- Statuses
('status', 'Available', 1),
('status', 'Assigned', 1),
('status', 'In Maintenance', 1),
('status', 'Reserved', 1),
('status', 'Disposed', 1),

-- Conditions
('condition', 'New', 1),
('condition', 'Excellent', 1),
('condition', 'Good', 1),
('condition', 'Fair', 1),
('condition', 'Poor', 1),
('condition', 'Defective', 1)

ON DUPLICATE KEY UPDATE
is_active = VALUES(is_active);
