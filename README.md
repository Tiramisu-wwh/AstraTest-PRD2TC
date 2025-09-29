# PRD测试用例生成系统

基于AI的PRD文档测试用例自动生成系统，支持文档上传、智能分析和测试用例管理。

## 快速开始

### 系统要求
- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- 4GB+ 内存

### 一键启动

```bash
# 克隆项目
git clone <repository-url>
cd AstraTest-PRD2TC

# 给启动脚本执行权限
chmod +x start.sh stop.sh

# 启动系统
./start.sh
```

### 访问系统
- **前端界面**: http://localhost:5173
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs

### 停止系统
```bash
./stop.sh
```

## 功能特性

### 🚀 核心功能
- **文档上传**: 支持PDF、Word、文本文件
- **智能分析**: AI自动解析PRD生成测试用例
- **用例管理**: 完整的增删改查功能
- **数据导出**: 支持导出Excel格式
- **会话管理**: 多项目分析支持

### 🎨 界面特色
- **现代化设计**: Ant Design + React
- **响应式布局**: 支持桌面和移动端
- **直观操作**: 拖拽上传、步骤引导
- **实时反馈**: 操作状态即时显示

### 🔧 技术架构
- **前端**: React 18 + TypeScript + Ant Design
- **后端**: Python FastAPI + SQLAlchemy
- **数据库**: MySQL 8.0
- **AI集成**: 阿里云千问API

## 使用指南

### 1. 创建新会话
点击侧边栏的"新建会话"按钮开始分析。

### 2. 上传PRD文档
- 支持格式：PDF、Word文档、文本文件
- 拖拽或点击上传
- 自动提取文档内容

### 3. AI智能分析
- 点击"开始AI分析"按钮
- 系统自动解析文档内容
- 生成结构化测试用例

### 4. 管理测试用例
- 查看生成的测试用例
- 编辑、删除、新增用例
- 导出Excel格式文件

## 部署说明

详细的生产环境部署指南请参考：[部署文档](docs/deployment.md)

### 开发环境
```bash
# 后端
cd backend
python -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
uvicorn main:app --reload

# 前端
cd frontend/prd-test-frontend
pnpm install
pnpm dev
```

### 生产环境
使用Docker或直接部署到服务器，具体步骤见部署文档。

## 配置说明

### 数据库配置
```bash
# 修改 backend/database.py 中的连接字符串
DATABASE_URL = "mysql+mysqlconnector://user:password@localhost:3306/prd_test_system"
```

### AI配置
系统预置阿里云千问API，您也可以在设置页面添加其他AI服务。

## 故障排除

### 常见问题
1. **MySQL连接失败**: 检查MySQL服务状态和连接配置
2. **文件上传失败**: 确认uploads目录权限和文件格式
3. **AI分析失败**: 验证API密钥和网络连接
4. **前端空白页**: 检查后端服务是否正常运行

### 日志查看
```bash
# 查看日志
tail -f logs/backend.log
tail -f logs/frontend.log
```