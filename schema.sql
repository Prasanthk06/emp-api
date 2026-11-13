CREATE DATABASE IF NOT EXISTS yourdb;
USE yourdb;

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  designation VARCHAR(100),
  salary DECIMAL(10,2) NOT NULL,
  joining_date DATE,
  status VARCHAR(20) DEFAULT 'Active',
  INDEX idx_dept_desig_status (department, designation, status),
  INDEX idx_desig_status (designation, status)
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  INDEX idx_orders_status_cust_amt (status, customer_id, total_amount)
);

CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id INT NOT NULL UNIQUE,
  user_id INT,
  title VARCHAR(255),
  body TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Task 3
SELECT c.name,
       t.total_orders,
       t.total_purchase_amount
FROM (
  SELECT customer_id,
         COUNT(*)          AS total_orders,
         SUM(total_amount) AS total_purchase_amount
  FROM orders
  WHERE status = 'completed'
  GROUP BY customer_id
  ORDER BY total_purchase_amount DESC, customer_id
  LIMIT 3
) t
JOIN customers c ON c.customer_id = t.customer_id
ORDER BY t.total_purchase_amount DESC, t.customer_id;