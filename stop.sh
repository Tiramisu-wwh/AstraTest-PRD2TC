#!/bin/bash

# PRD测试用例生成系统 - 停止脚本

set -e

echo "=== 停止PRD测试用例生成系统 ==="

# 进入项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 停止后端服务
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "停止后端服务 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm logs/backend.pid
        echo "✓ 后端服务已停止"
    else
        echo "后端服务已经停止"
        rm -f logs/backend.pid
    fi
else
    echo "未找到后端服务PID文件"
fi

# 停止前端服务
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "停止前端服务 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm logs/frontend.pid
        echo "✓ 前端服务已停止"
    else
        echo "前端服务已经停止"
        rm -f logs/frontend.pid
    fi
else
    echo "未找到前端服务PID文件"
fi

# 清理可能残留的进程
echo "清理残留进程..."
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "系统已完全停止"
echo ""