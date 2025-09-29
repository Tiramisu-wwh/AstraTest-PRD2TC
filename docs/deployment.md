# AstraTest-PRD2TC - 完整部署指南

## 项目概述

这是一个基于React + Ant Design + Python FastAPI + MySQL架构的AstraTest-PRD2TC系统，支持文档上传、AI智能分析和测试用例管理。

## 技术栈

### 后端
- **框架**: Python FastAPI
- **数据库**: MySQL 8.0+
- **ORM**: SQLAlchemy
- **文件处理**: PyPDF2, python-docx, pdfplumber
- **AI集成**: HTTP客户端调用AI API

### 前端
- **框架**: React 18 + TypeScript
- **UI库**: Ant Design
- **状态管理**: React Query + Context API
- **路由**: React Router DOM
- **HTTP客户端**: Axios

## 环境要求

- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- pnpm（推荐）或 npm

## 部署步骤

### 1. 数据库初始化

#### 安装MySQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS/RHEL
sudo yum install mysql-server

# macOS
brew install mysql
```

#### 启动MySQL服务
```bash
# Linux
sudo systemctl start mysql
sudo systemctl enable mysql

# macOS
brew services start mysql
```

#### 创建数据库和用户
```sql
-- 登录MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE astratest_prd2tc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选，生产环境推荐）
CREATE USER 'prd_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON astratest_prd2tc.* TO 'prd_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 初始化数据库表
```bash
cd AstraTest-PRD2TC/database
mysql -u root -p astratest_prd2tc < init.sql
```

### 2. 后端部署

#### 安装Python依赖
```bash
cd AstraTest-PRD2TC/backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

#### 配置环境变量
```bash
# 创建 .env 文件
cat > .env << EOF
DATABASE_URL=mysql+mysqlconnector://root:password@localhost:3306/astratest_prd2tc
EOF
```

#### 启动后端服务
```bash
# 开发环境
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产环境
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. 前端部署

#### 安装Node.js依赖
```bash
cd AstraTest-PRD2TC/frontend/prd-test-frontend

# 安装pnpm（如果还没有）
npm install -g pnpm

# 安装依赖
pnpm install
```

#### 开发环境启动
```bash
pnpm dev
```

#### 生产环境构建
```bash
# 构建
pnpm build

# 预览（可选）
pnpm preview
```

### 4. 生产环境部署

#### 使用Nginx部署前端

1. 安装Nginx
```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

2. 配置Nginx
```bash
sudo nano /etc/nginx/sites-available/astratest-prd2tc
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /path/to/AstraTest-PRD2TC/frontend/astratest-prd2tc/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端API代理
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 上传文件代理
    location /uploads/ {
        proxy_pass http://localhost:8000/uploads/;
    }
}
```

3. 启用站点
```bash
sudo ln -s /etc/nginx/sites-available/astratest-prd2tc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 使用systemd管理后端服务

1. 创建systemd服务文件
```bash
sudo nano /etc/systemd/system/astratest-prd2tc.service
```

2. 添加以下内容：
```ini
[Unit]
Description=AstraTest-PRD2TC API
After=network.target mysql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/AstraTest-PRD2TC/backend
Environment=PATH=/path/to/AstraTest-PRD2TC/backend/venv/bin
ExecStart=/path/to/AstraTest-PRD2TC/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

3. 启动服务
```bash
sudo systemctl daemon-reload
sudo systemctl enable astratest-prd2tc
sudo systemctl start astratest-prd2tc
```

## 配置说明

### AI API配置

系统默认使用阿里云千问API，配置如下：
- **API端点**: https://chat.r2ai.com.cn/v1
- **模型**: qwen3
- **API Key**: sk-39f1ea53b129582a837d6223cceabb8e

您也可以在设置页面添加其他AI服务提供商。

### 文件上传配置

- **支持格式**: PDF, Word文档(.docx, .doc), 文本文件(.txt, .md)
- **存储位置**: backend/uploads/ 目录
- **大小限制**: 默认无限制，可在Nginx中配置

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 验证数据库连接字符串
   - 确认数据库用户权限

2. **文件上传失败**
   - 检查uploads目录权限
   - 确认文件格式支持
   - 查看后端日志

3. **AI分析失败**
   - 验证API密钥是否正确
   - 检查网络连接
   - 查看AI配置是否激活

4. **前端无法访问后端**
   - 检查CORS配置
   - 验证API端点URL
   - 确认后端服务运行状态

### 日志查看

```bash
# 后端日志
sudo journalctl -u astratest-prd2tc -f

# Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MySQL日志
sudo tail -f /var/log/mysql/error.log
```

## 性能优化

### 数据库优化
- 为常用查询字段添加索引
- 定期清理过期数据
- 配置适当的连接池大小

### 前端优化
- 启用Gzip压缩
- 配置静态资源缓存
- 使用CDN加速

### 后端优化
- 增加uvicorn workers数量
- 配置适当的超时时间
- 实现接口缓存

## 安全建议

1. **API安全**
   - 使用HTTPS
   - 实施API限流
   - 添加身份认证

2. **数据库安全**
   - 使用强密码
   - 限制网络访问
   - 定期备份数据

3. **文件安全**
   - 验证文件类型
   - 限制文件大小
   - 扫描恶意文件

## 维护和监控

### 日常维护
- 定期更新依赖包
- 监控系统资源使用
- 备份重要数据

### 监控指标
- API响应时间
- 数据库连接数
- 文件上传成功率
- AI分析成功率

## 联系支持

如果您在部署过程中遇到问题，请：
1. 查看相关日志文件
2. 检查配置是否正确
3. 参考故障排除部分
4. 联系技术支持团队