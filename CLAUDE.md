# CLAUDE.md

此文件为Claude Code (claude.ai/code) 提供在此代码仓库中工作的指导。

## 项目概览

AstraTest-PRD2TC - 基于AI的PRD文档测试用例自动生成系统，支持文档上传、智能分析和测试用例管理。

## 系统架构

- **后端**: Python FastAPI + SQLAlchemy + MySQL 8.0
- **前端**: React 18 + TypeScript + Ant Design + Vite
- **AI集成**: 阿里云千问API（可配置）
- **文件处理**: PDF (PyPDF2/pdfplumber)、Word (python-docx)、文本文件

## 开发命令

### 后端开发
```bash
cd backend
# 设置虚拟环境（如果不存在）
python3 -m venv venv
source venv/bin/activate

# 安装依赖（如遇到网络问题，使用清华镜像）
pip install -r requirements.txt
# 或者使用清华镜像：pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 运行开发服务器
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 数据库迁移（如需要）
alembic upgrade head
```

### 前端开发
```bash
cd frontend/astratest-prd2tc

# 安装依赖（使用pnpm）
pnpm install

# 运行开发服务器
pnpm dev

# 生产环境构建
pnpm build

# 代码检查
pnpm lint
```

### 全系统管理
```bash
# 启动整个系统（后端+前端）
./start.sh

# 停止整个系统
./stop.sh
```

## 关键后端组件

- **main.py**: FastAPI应用入口，包含所有API端点
- **models.py**: SQLAlchemy ORM模型（FileUpload、TestCase、ChatSession、AIConfiguration）
- **database.py**: 数据库连接配置（MySQL）
- **schemas.py**: Pydantic模型用于请求/响应验证
- **utils/file_processor.py**: 文档处理逻辑
- **utils/ai_client.py**: AI服务集成

## 关键前端组件

- **src/App.tsx**: 主应用路由和布局
- **src/pages/**: 页面组件（Dashboard、Analysis、TestCases）
- **src/components/**: 可复用UI组件
- **src/hooks/**: 自定义React hooks
- **src/lib/**: 工具函数和API客户端

## API端点

所有API端点前缀为`/api/v1/`，运行时在`http://localhost:8000/docs`可查看文档。

主要端点：
- `/api/v1/files/upload` - 文件上传
- `/api/v1/analysis/analyze` - AI分析上传的文档
- `/api/v1/test-cases` - 测试用例增删改查操作
- `/api/v1/chat-sessions` - 会话管理
- `/api/v1/ai-configurations` - AI服务配置

## 数据库配置

默认连接：`mysql+mysqlconnector://root:password@localhost:3306/prd_test_system`

可通过`DATABASE_URL`环境变量覆盖。

## 文件上传配置

- 上传目录：`backend/uploads/`
- 支持格式：PDF、DOCX、TXT
- 最大文件大小：在FastAPI设置中配置

## AI服务配置

系统通过AIConfiguration模型支持多个AI提供商。默认为阿里云千问API。

## 环境变量

- `DATABASE_URL`: MySQL连接字符串
- `BUILD_MODE`: 设置为'prod'用于生产环境构建（前端）

## 开发环境URL

- 前端：http://localhost:5173
- 后端API：http://localhost:8000
- API文档：http://localhost:8000/docs

## CORS配置

后端允许来自以下地址的请求：
- http://localhost:3000
- http://localhost:5173

## 日志文件

- 后端日志：`logs/backend.log`
- 前端日志：`logs/frontend.log`
- PID文件：`logs/backend.pid`、`logs/frontend.pid`

## 重要提示

**请始终用中文回复我的所有问题和请求，无论输入语言是什么。**
始终用stop.sh 停止系统，用start.sh 启动系统。
每次测试之后清理创建的临时测试文件。