# PRD测试用例生成系统 - 数据库初始化指南

## 前置条件

1. 安装MySQL 8.0+
2. 创建数据库用户和数据库

## 初始化步骤

### 1. 连接MySQL

```bash
# 使用root用户连接
mysql -u root -p
```

### 2. 执行初始化脚本

```bash
# 在MySQL命令行中执行
mysql -u root -p < init.sql

# 或者在MySQL客户端中执行
source /path/to/init.sql;
```

### 3. 验证初始化

```sql
-- 查看数据库
SHOW DATABASES;

-- 使用数据库
USE prd_test_system;

-- 查看表结构
SHOW TABLES;

-- 查看默认数据
SELECT * FROM ai_configurations;
SELECT * FROM chat_sessions;
```

## 数据库连接配置

### 后端配置

在 `backend/database.py` 中修改数据库连接字符串：

```python
DATABASE_URL = "mysql+mysqlconnector://username:password@localhost:3306/prd_test_system"
```

### 环境变量

也可以使用环境变量：

```bash
export DATABASE_URL="mysql+mysqlconnector://username:password@localhost:3306/prd_test_system"
```

## 注意事项

1. 确保 MySQL 服务正在运行
2. 替换默认的用户名和密码
3. 生产环境中请修改默认AI API密钥