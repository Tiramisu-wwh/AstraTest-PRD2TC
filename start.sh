#!/bin/bash

# AstraTest-PRD2TC - 启动脚本

set -e

echo "=== AstraTest-PRD2TC 启动脚本 ==="

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: Python3 未安装"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    exit 1
fi

# 检查MySQL是否运行
if ! pgrep -x "mysqld" > /dev/null; then
    echo "警告: MySQL 服务可能未运行"
    echo "请确保MySQL服务已启动"
fi

# 进入项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "项目根目录: $PROJECT_ROOT"

# 检查并创建日志目录
mkdir -p logs

# 启动后端服务
echo "正在启动后端服务..."
cd backend

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装Python依赖
echo "安装Python依赖..."
pip3 install -r requirements.txt

# 创建上传目录
mkdir -p uploads

# 启动FastAPI服务（后台运行）
echo "启动FastAPI服务..."
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "后端服务PID: $BACKEND_PID"
echo $BACKEND_PID > ../logs/backend.pid

# 等待后端服务启动
echo "等待后端服务启动..."
sleep 5

# 检查后端服务是否正常运行
if curl -f http://localhost:8000/ > /dev/null 2>&1; then
    echo "✓ 后端服务启动成功"
else
    echo "✗ 后端服务启动失败，请检查日志: logs/backend.log"
    exit 1
fi

# 切换到前端目录
cd ../frontend/astratest-prd2tc

# 检查pnpm是否安装
if ! command -v pnpm &> /dev/null; then
    echo "安装pnpm..."
    npm install -g pnpm
fi

# 安装前端依赖
echo "安装前端依赖..."
pnpm install

# 启动前端开发服务器（后台运行）
echo "启动前端开发服务器..."
nohup pnpm dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务PID: $FRONTEND_PID"
echo $FRONTEND_PID > ../../logs/frontend.pid

# 等待前端服务启动
echo "等待前端服务启动..."
sleep 10

# 检查前端服务是否正常运行
if curl -f http://localhost:5173/ > /dev/null 2>&1; then
    echo "✓ 前端服务启动成功"
else
    echo "警告: 前端服务可能启动失败，请检查日志: logs/frontend.log"
fi

cd "$PROJECT_ROOT"

echo ""
echo "=== 系统启动完成 ==="
echo "前端地址: http://localhost:5173"
echo "后端API: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo ""
echo "日志文件:"
echo "  后端日志: logs/backend.log"
echo "  前端日志: logs/frontend.log"
echo ""
echo "停止服务请运行: ./stop.sh"
echo ""